'use strict';

const crypto = require('node:crypto');
const {
  normalizeName,
  parseTeacherTrackingSheet,
} = require('./google-sheet-csv');

function parseGoogleSheetUrl(input) {
  const raw = String(input || '').trim();
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Google Sheets URL không hợp lệ.');
  }

  if (!/(^|\.)docs\.google\.com$/i.test(url.hostname)) {
    throw new Error('Chỉ hỗ trợ nguồn docs.google.com/spreadsheets.');
  }

  const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/i);
  if (!match) throw new Error('Không tìm thấy Spreadsheet ID trong URL.');

  let gid = url.searchParams.get('gid');
  if (!gid && url.hash) {
    const hashMatch = url.hash.match(/(?:^#|[&#])gid=(\d+)/i);
    if (hashMatch) gid = hashMatch[1];
  }

  return {
    spreadsheetId: match[1],
    sheetGid: gid || '0',
    canonicalUrl: `https://docs.google.com/spreadsheets/d/${match[1]}/edit?gid=${gid || '0'}#gid=${gid || '0'}`,
  };
}

function buildCsvUrl(spreadsheetId, sheetGid) {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/export?format=csv&gid=${encodeURIComponent(String(sheetGid || '0'))}`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function fetchText(url, { timeoutMs = 15000, retries = 2, maxBytes = 10 * 1024 * 1024 } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'user-agent': 'English-Classroom/0.21.0 Google-Sheets-Sync',
          accept: 'text/csv,text/plain;q=0.9,*/*;q=0.1',
        },
      });

      if (!response.ok) {
        throw new Error(`Google Sheets trả HTTP ${response.status}. Kiểm tra quyền Viewer của file.`);
      }

      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > maxBytes) throw new Error(`Google Sheet quá lớn (${contentLength} bytes).`);

      const text = await response.text();
      if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new Error('Google Sheet vượt giới hạn dung lượng cho phép.');
      return text;
    } catch (error) {
      lastError = error?.name === 'AbortError'
        ? new Error(`Hết thời gian tải Google Sheet sau ${timeoutMs}ms.`)
        : error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

function vietnamToday() {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function isDateAllowed(source, observedOn) {
  if (!observedOn) return { allowed: false, warning: 'Cột dữ liệu không xác định được ngày.' };
  if (source.import_from_date && observedOn < String(source.import_from_date).slice(0, 10)) {
    return { allowed: false, warning: `Ngày ${observedOn} trước giới hạn import_from_date.` };
  }
  if (source.import_to_date && observedOn > String(source.import_to_date).slice(0, 10)) {
    return { allowed: false, warning: `Ngày ${observedOn} sau giới hạn import_to_date.` };
  }

  const settings = source.settings || {};
  if (settings.skip_future_dates !== false && observedOn > vietnamToday()) {
    return { allowed: false, warning: `Ngày ${observedOn} nằm trong tương lai; chỉ lưu staging, không cập nhật bảng nghiệp vụ.` };
  }
  return { allowed: true, warning: null };
}

function buildStudentMatcher(classStudents) {
  const map = new Map();
  for (const student of classStudents) {
    const key = normalizeName(student.full_name);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(student);
  }

  return function match(name) {
    const key = normalizeName(name);
    const candidates = map.get(key) || [];
    if (candidates.length === 1) {
      return { studentId: candidates[0].id, status: 'MATCHED', method: 'EXACT_NAME', confidence: 100 };
    }
    if (candidates.length > 1) {
      return { studentId: null, status: 'AMBIGUOUS', method: 'EXACT_NAME_DUPLICATE', confidence: 0 };
    }
    return { studentId: null, status: 'UNMATCHED', method: 'EXACT_NAME', confidence: 0 };
  };
}

function getSettings(source) {
  const settings = source.settings || {};
  return {
    materializeScores: settings.materialize_scores !== false,
    materializeAssessments: settings.materialize_assessments !== false,
    materializeAttendance: settings.materialize_attendance !== false,
    materializeNotes: settings.materialize_notes !== false,
    materializeSkillEvents: settings.materialize_skill_events !== false,
    autoCreateSession: settings.auto_create_session !== false,
  };
}

function createGoogleSheetService({ pool, repository, logger = console }) {
  if (!pool) throw new Error('GoogleSheetService cần pg Pool.');
  if (!repository) throw new Error('GoogleSheetService cần repository.');

  async function createSource({ teacherId, classId, name, url, intervalMinutes = 15, importFromDate = null }) {
    const parsed = parseGoogleSheetUrl(url);
    return repository.createSource({
      teacherId,
      classId,
      name: String(name || 'Google Sheets').trim().slice(0, 250),
      spreadsheetId: parsed.spreadsheetId,
      sheetGid: parsed.sheetGid,
      sourceUrl: parsed.canonicalUrl,
      intervalMinutes: Math.min(Math.max(Number(intervalMinutes) || 15, 5), 1440),
      importFromDate: importFromDate || null,
    });
  }

  async function syncSource(sourceId, { triggerType = 'SCHEDULED', teacherId = null, force = false } = {}) {
    const initialSource = await repository.getSource(sourceId, teacherId);
    if (!initialSource) throw new Error('Không tìm thấy nguồn dữ liệu hoặc bạn không có quyền truy cập.');
    if (!initialSource.enabled && triggerType === 'SCHEDULED') return { status: 'DISABLED' };

    const run = await repository.createRun(initialSource.id, triggerType);
    const stats = {
      status: 'RUNNING',
      contentHash: null,
      rowsRead: 0,
      studentsSeen: 0,
      studentsMatched: 0,
      observationsSeen: 0,
      observationsInserted: 0,
      observationsUpdated: 0,
      materializedScores: 0,
      materializedAttendance: 0,
      materializedNotes: 0,
      assessmentsSeen: 0,
      assessmentResultsSeen: 0,
      materializedAssessmentResults: 0,
      skipped: 0,
      errorsCount: 0,
      details: { warnings: [], unmatched: [] },
    };

    try {
      const csvUrl = buildCsvUrl(initialSource.spreadsheet_id, initialSource.sheet_gid);
      const csvText = await fetchText(csvUrl, {
        timeoutMs: Number(process.env.GOOGLE_SHEET_FETCH_TIMEOUT_MS || 15000),
        retries: Number(process.env.GOOGLE_SHEET_FETCH_RETRIES || 2),
      });
      stats.contentHash = sha256(csvText);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const locked = await repository.acquireSourceLock(client, initialSource.id);
        if (!locked) {
          await client.query('ROLLBACK');
          stats.status = 'LOCKED';
          stats.message = 'Một tiến trình khác đang đồng bộ nguồn này.';
          await repository.finishRun(run.id, stats);
          return stats;
        }

        const source = await repository.getSource(initialSource.id, teacherId, client);
        if (!source) throw new Error('Nguồn dữ liệu đã bị thay đổi/xóa trong lúc đồng bộ.');

        if (!force && source.last_content_hash && source.last_content_hash === stats.contentHash) {
          await repository.updateSourceState(source.id, {
            last_synced_at: new Date(),
            last_error: null,
          }, client);
          await client.query('COMMIT');
          stats.status = 'NO_CHANGE';
          stats.message = 'Google Sheet không thay đổi từ lần đồng bộ trước.';
          await repository.finishRun(run.id, stats);
          return stats;
        }

        const parsed = parseTeacherTrackingSheet(csvText, { sourceId: source.id });
        stats.rowsRead = parsed.rowsRead;
        stats.studentsSeen = parsed.students.length;
        const classStudents = await repository.getClassStudents(source.class_id, client);
        const matchStudent = buildStudentMatcher(classStudents);
        const settings = getSettings(source);
        const sessionCache = new Map();
        const assessmentMap = new Map();

        for (const parsedAssessment of parsed.assessments || []) {
          const assessment = await repository.upsertAssessment({
            sourceId: source.id,
            classId: source.class_id,
            externalAssessmentKey: parsedAssessment.externalAssessmentKey,
            observedOn: parsedAssessment.observedOn,
            title: parsedAssessment.title,
            assessmentType: parsedAssessment.assessmentType,
            skillCode: parsedAssessment.skillCode,
            rawMaxScore: parsedAssessment.rawMaxScore,
            normalizedMaxScore: 10,
            sourceColumnStart: parsedAssessment.sourceColumnStart,
            sourceColumnEnd: parsedAssessment.sourceColumnEnd,
            metadata: {
              dateConfidence: parsedAssessment.dateConfidence,
              sourceColumns: parsedAssessment.sourceColumns,
            },
          }, client);
          assessmentMap.set(parsedAssessment.externalAssessmentKey, assessment);
          stats.assessmentsSeen += 1;
        }

        for (const extStudent of parsed.students) {
          const existingLink = await repository.getStudentLink(source.id, extStudent.externalStudentKey, client);
          let match;
          if (existingLink?.match_method === 'MANUAL' && existingLink.student_id) {
            match = { studentId: existingLink.student_id, status: 'MATCHED', method: 'MANUAL', confidence: 100 };
          } else {
            match = matchStudent(extStudent.externalStudentName);
          }

          const link = await repository.upsertStudentLink({
            sourceId: source.id,
            externalStudentKey: extStudent.externalStudentKey,
            externalStudentName: extStudent.externalStudentName,
            externalRowHint: extStudent.externalRowHint,
            studentId: match.studentId,
            matchStatus: match.status,
            matchMethod: match.method,
            confidence: match.confidence,
          }, client);

          if (link.student_id && link.match_status === 'MATCHED') {
            stats.studentsMatched += 1;
          } else if (stats.details.unmatched.length < 100) {
            stats.details.unmatched.push({
              key: extStudent.externalStudentKey,
              name: extStudent.externalStudentName,
              status: link.match_status,
            });
          }

          const observationMap = new Map();
          for (const item of extStudent.observations) {
            stats.observationsSeen += 1;
            const dateCheck = isDateAllowed(source, item.observedOn);
            let warning = dateCheck.warning;

            if (!warning && item.dateConfidence === 'UNBOUNDED_LAST_GROUP' && source.settings?.allow_unbounded_last_date_group !== true) {
              warning = 'Cột nằm sau nhóm ngày cuối cùng và không có mốc ngày kế tiếp để xác định biên; chỉ lưu staging.';
            }

            if (item.observationType === 'SCORE' && item.numericValue != null && item.maxValue != null) {
              if (item.numericValue < 0 || item.numericValue > item.maxValue) {
                warning = `Điểm ${item.numericValue}/${item.maxValue} không hợp lệ; chỉ lưu staging.`;
              }
            }

            const { observation, inserted } = await repository.upsertObservation({
              sourceId: source.id,
              syncRunId: run.id,
              externalStudentKey: extStudent.externalStudentKey,
              studentId: link.student_id,
              classId: source.class_id,
              observedOn: item.observedOn,
              sourceColumnIndex: item.sourceColumnIndex,
              fieldName: item.fieldName,
              observationType: item.observationType,
              skillCode: item.skillCode,
              rawValue: item.rawValue,
              numericValue: item.numericValue,
              maxValue: item.maxValue,
              normalizedStatus: item.normalizedStatus,
              observationKey: item.observationKey,
              warning,
              payload: {
                rawDateHeader: item.rawDateHeader,
                dateConfidence: item.dateConfidence,
                sourceRow: extStudent.sourceRowIndex + 1,
                stt: extStudent.externalRowHint,
                assessmentKey: item.assessmentKey || null,
                assessmentTitle: item.assessmentTitle || null,
              },
            }, client);
            observationMap.set(item.observationKey, observation);

            if (inserted) stats.observationsInserted += 1;
            else stats.observationsUpdated += 1;

            if (warning && stats.details.warnings.length < 100) {
              stats.details.warnings.push({ student: extStudent.externalStudentName, field: item.fieldName, warning });
            }

            if (!link.student_id || !dateCheck.allowed || warning) {
              stats.skipped += 1;
              continue;
            }

            const sourceForMaterialization = { ...source, materializeSkillEvents: settings.materializeSkillEvents };

            if (
              settings.materializeScores &&
              !item.assessmentKey &&
              observation.observation_type === 'SCORE' &&
              observation.numeric_value != null &&
              observation.max_value != null &&
              observation.max_value > 0
            ) {
              await repository.materializeScore({ observation, source: sourceForMaterialization }, client);
              stats.materializedScores += 1;
              continue;
            }

            if (
              settings.materializeAttendance &&
              observation.observation_type === 'ATTENDANCE' &&
              observation.normalized_status
            ) {
              let sessionInfo = sessionCache.get(observation.observed_on);
              if (!sessionInfo) {
                sessionInfo = await repository.ensureSessionLink({
                  source,
                  observedOn: observation.observed_on,
                  autoCreateSession: settings.autoCreateSession,
                }, client);
                sessionCache.set(observation.observed_on, sessionInfo);
              }

              if (!sessionInfo.session) {
                stats.skipped += 1;
                if (sessionInfo.warning && stats.details.warnings.length < 100) {
                  stats.details.warnings.push({ student: extStudent.externalStudentName, field: item.fieldName, warning: sessionInfo.warning });
                }
                continue;
              }

              const result = await repository.materializeAttendance({ observation, source, session: sessionInfo.session }, client);
              if (result.updated) stats.materializedAttendance += 1;
              else {
                stats.skipped += 1;
                if (result.conflict && stats.details.warnings.length < 100) {
                  stats.details.warnings.push({ student: extStudent.externalStudentName, field: item.fieldName, warning: result.conflict });
                }
              }
              continue;
            }

            if (settings.materializeNotes && observation.observation_type === 'NOTE') {
              let sessionId = null;
              if (observation.observed_on && sessionCache.has(observation.observed_on)) {
                sessionId = sessionCache.get(observation.observed_on)?.session?.id || null;
              }
              await repository.materializeNote({ observation, source, classSessionId: sessionId }, client);
              stats.materializedNotes += 1;
            }
          }

          for (const parsedResult of extStudent.assessmentResults || []) {
            stats.assessmentResultsSeen += 1;
            let assessment = assessmentMap.get(parsedResult.externalAssessmentKey);
            if (!assessment) continue;

            if (parsedResult.rawMaxScore != null && assessment.raw_max_score == null) {
              assessment = await repository.upsertAssessment({
                sourceId: source.id,
                classId: source.class_id,
                externalAssessmentKey: parsedResult.externalAssessmentKey,
                observedOn: parsedResult.observedOn,
                title: parsedResult.title,
                assessmentType: parsedResult.assessmentType,
                skillCode: parsedResult.skillCode,
                rawMaxScore: parsedResult.rawMaxScore,
                normalizedMaxScore: parsedResult.normalizedMaxScore || 10,
                sourceColumnStart: parsedResult.sourceColumnStart,
                sourceColumnEnd: parsedResult.sourceColumnEnd,
                metadata: { inferredMaxFromResult: parsedResult.detectionMode === 'NORMALIZED_RAW_PAIR_INFERRED_MAX' },
              }, client);
              assessmentMap.set(parsedResult.externalAssessmentKey, assessment);
            }

            const dateCheck = isDateAllowed(source, parsedResult.observedOn);
            let warning = parsedResult.warning || dateCheck.warning;
            if (
              !warning &&
              parsedResult.rawMaxScore != null &&
              assessment.raw_max_score != null &&
              Math.abs(Number(parsedResult.rawMaxScore) - Number(assessment.raw_max_score)) > 0.001
            ) {
              warning = `Thang điểm suy luận ${parsedResult.rawMaxScore} không khớp thang ${assessment.raw_max_score} của cùng bài; chỉ lưu staging.`;
            }
            if (!warning && parsedResult.dateConfidence === 'UNBOUNDED_LAST_GROUP' && source.settings?.allow_unbounded_last_date_group !== true) {
              warning = 'Nhóm bài kiểm tra nằm sau mốc ngày cuối cùng chưa có biên xác nhận; chỉ lưu staging.';
            }

            const primaryObservation = parsedResult.primaryObservationKey
              ? observationMap.get(parsedResult.primaryObservationKey)
              : null;
            const assessmentResult = await repository.upsertAssessmentResult({
              assessmentId: assessment.id,
              syncRunId: run.id,
              externalStudentKey: extStudent.externalStudentKey,
              studentId: link.student_id,
              primaryObservationId: primaryObservation?.id || null,
              rawScore: parsedResult.rawScore,
              rawMaxScore: parsedResult.rawMaxScore,
              normalizedScore: parsedResult.normalizedScore,
              normalizedMaxScore: parsedResult.normalizedMaxScore || 10,
              confidence: parsedResult.confidence,
              detectionMode: parsedResult.detectionMode,
              warning,
              rawValues: parsedResult.rawValues,
            }, client);

            if (warning && stats.details.warnings.length < 100) {
              stats.details.warnings.push({ student: extStudent.externalStudentName, field: parsedResult.title, warning });
            }

            const hasScore = (
              (assessmentResult.raw_score != null && assessmentResult.raw_max_score != null && Number(assessmentResult.raw_max_score) > 0) ||
              (assessmentResult.normalized_score != null && Number(assessmentResult.normalized_max_score) > 0)
            );
            if (!settings.materializeScores || !settings.materializeAssessments || !link.student_id || !dateCheck.allowed || warning || !hasScore) {
              stats.skipped += 1;
              continue;
            }

            const sourceForMaterialization = { ...source, materializeSkillEvents: settings.materializeSkillEvents };
            const scoreId = await repository.materializeAssessmentResult({
              result: assessmentResult,
              assessment,
              source: sourceForMaterialization,
            }, client);
            if (scoreId) {
              stats.materializedAssessmentResults += 1;
              stats.materializedScores += 1;
            }
          }
        }

        stats.status = stats.details.unmatched.length || stats.details.warnings.length ? 'PARTIAL' : 'SUCCESS';
        stats.message = stats.status === 'SUCCESS'
          ? 'Đồng bộ Google Sheets thành công.'
          : 'Đồng bộ hoàn tất nhưng còn dữ liệu cần kiểm tra.';

        await repository.updateSourceState(source.id, {
          last_content_hash: stats.contentHash,
          last_synced_at: new Date(),
          last_success_at: new Date(),
          last_error: null,
        }, client);
        await client.query('COMMIT');
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch {}
        throw error;
      } finally {
        client.release();
      }

      await repository.finishRun(run.id, stats);
      return stats;
    } catch (error) {
      stats.status = 'FAILED';
      stats.errorsCount += 1;
      stats.message = error?.message || 'Đồng bộ Google Sheets thất bại.';
      logger.error?.('[GOOGLE_SHEET_SYNC]', { sourceId, error });
      try {
        await repository.updateSourceState(initialSource.id, {
          last_synced_at: new Date(),
          last_error: stats.message,
        });
      } catch {}
      try { await repository.finishRun(run.id, stats); } catch {}
      throw error;
    }
  }

  async function syncDueSources() {
    const sources = await repository.listDueSources();
    const results = [];
    for (const source of sources) {
      try {
        const result = await syncSource(source.id, { triggerType: 'SCHEDULED' });
        results.push({ sourceId: source.id, status: result.status });
      } catch (error) {
        results.push({ sourceId: source.id, status: 'FAILED', error: error.message });
      }
    }
    return results;
  }

  return {
    createSource,
    syncSource,
    syncDueSources,
    parseGoogleSheetUrl,
    buildCsvUrl,
  };
}

module.exports = {
  createGoogleSheetService,
  parseGoogleSheetUrl,
  buildCsvUrl,
  fetchText,
  sha256,
  isDateAllowed,
  buildStudentMatcher,
};
