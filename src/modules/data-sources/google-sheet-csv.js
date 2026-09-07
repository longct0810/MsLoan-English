'use strict';

const crypto = require('node:crypto');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  const input = String(text ?? '').replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }

  return rows;
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDate(value) {
  const raw = String(value ?? '').trim();
  const match = raw.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function extractHeaderMax(fieldName) {
  const raw = String(fieldName ?? '');
  const matches = [...raw.matchAll(/\/\s*(\d+(?:[.,]\d+)?)/g)];
  if (!matches.length) return null;
  const value = Number(matches[matches.length - 1][1].replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseFraction(value) {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^(-?\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/);
  if (!match) return null;
  const score = Number(match[1].replace(',', '.'));
  const max = Number(match[2].replace(',', '.'));
  if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0) return null;
  return { score, max };
}

function parseNumber(value) {
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) return null;
  const result = Number(raw);
  return Number.isFinite(result) ? result : null;
}

function roundScore(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function detectSkill(fieldName) {
  const n = normalizeText(fieldName);
  if (/\b(reading|doc hieu)\b/.test(n)) return 'READING';
  if (/\b(listening|nghe)\b/.test(n)) return 'LISTENING';
  if (/\b(writing|viet)\b/.test(n)) return 'WRITING';
  if (/\b(speaking|noi)\b/.test(n)) return 'SPEAKING';
  if (/\b(pronunciation|phat am)\b/.test(n)) return 'PRONUNCIATION';
  if (/\b(vocabulary|tu vung|vocab)\b/.test(n)) return 'VOCABULARY';
  if (/\b(grammar|tenses?|thi dong tu|ngu phap)\b/.test(n)) return 'GRAMMAR';
  return null;
}

function normalizeAttendance(value) {
  const n = normalizeText(value);
  if (['1', 'x', 'co', 'co mat', 'present'].includes(n)) return 'PRESENT';
  if (['0', 'vang', 'nghi', 'absent'].includes(n)) return 'ABSENT';
  if (n.includes('co phep') || n.includes('vang phep')) return 'ABSENT_EXCUSED';
  if (n.includes('muon') || n.includes('late')) return 'LATE';
  if (n.includes('online')) return 'ONLINE';
  return null;
}

function normalizeHomework(value) {
  const n = normalizeText(value);
  if (!n) return null;
  if (['ht', 'hoan thanh', 'done', 'completed'].includes(n) || n.includes('hoan thanh')) return 'COMPLETED';
  if (n.includes('chua') || n.includes('not done') || n.includes('unfinished')) return 'NOT_COMPLETED';
  if (n.includes('nghi')) return 'ABSENT';
  if (n.includes('quen')) return 'FORGOT';
  if (n.includes('moi nhan')) return 'RECEIVED';
  if (n.includes('da chua')) return 'REVIEWED';
  return null;
}

function classifyObservation(fieldName, rawValue) {
  const field = normalizeText(fieldName);
  const raw = String(rawValue ?? '').trim();
  const rawNorm = normalizeText(raw);
  const skillCode = detectSkill(fieldName);
  const fraction = parseFraction(raw);
  const headerMax = extractHeaderMax(fieldName);
  const numeric = parseNumber(raw);

  if (field.includes('diem danh') || field.includes('attendance')) {
    return {
      type: 'ATTENDANCE',
      normalizedStatus: normalizeAttendance(raw),
      skillCode: null,
      numericValue: numeric,
      maxValue: 1,
    };
  }

  if (
    field.includes('cambridge') ||
    field.includes('cefr') ||
    (/\blevel\b/.test(field) && /^(a1|a2|b1|b2|c1|c2)$/.test(rawNorm)) ||
    /^(a1|a2|b1|b2|c1|c2)$/.test(rawNorm)
  ) {
    return {
      type: 'LEVEL',
      normalizedStatus: raw.toUpperCase(),
      skillCode: null,
      numericValue: null,
      maxValue: null,
    };
  }

  const scoreishField = /\b(test|kiem tra|reading|listening|grammar|tenses?|vocabulary|tu vung|score|diem|pet|unit|quiz)\b/.test(field);

  if (fraction) {
    return {
      type: 'SCORE',
      normalizedStatus: null,
      skillCode,
      numericValue: fraction.score,
      maxValue: fraction.max,
    };
  }

  if (numeric !== null && headerMax !== null) {
    return {
      type: 'SCORE',
      normalizedStatus: null,
      skillCode,
      numericValue: numeric,
      maxValue: headerMax,
    };
  }

  if (numeric !== null && scoreishField && numeric >= 0 && numeric <= 10) {
    return {
      type: 'SCORE',
      normalizedStatus: null,
      skillCode,
      numericValue: numeric,
      maxValue: 10,
    };
  }

  const homeworkStatus = normalizeHomework(raw);
  if (/\b(btvn|bai tap|homework|workbook|sach)\b/.test(field) && homeworkStatus) {
    return {
      type: 'HOMEWORK_STATUS',
      normalizedStatus: homeworkStatus,
      skillCode,
      numericValue: null,
      maxValue: null,
    };
  }

  if (/\b(luu y|ghi chu|nhan xet|chu y|can chu y|note)\b/.test(field)) {
    return {
      type: 'NOTE',
      normalizedStatus: null,
      skillCode,
      numericValue: null,
      maxValue: null,
    };
  }

  return {
    type: 'TEXT',
    normalizedStatus: homeworkStatus,
    skillCode,
    numericValue: numeric,
    maxValue: headerMax,
  };
}

function looksLikeStudentDataRow(row, sttIndex, nameIndex) {
  const rawName = String(row?.[nameIndex] ?? '').trim();
  const normalizedName = normalizeName(rawName);

  if (!normalizedName || ['ho va ten', 'ho ten'].includes(normalizedName)) return false;

  if (sttIndex >= 0) {
    const rawStt = String(row?.[sttIndex] ?? '').trim();
    if (/^\d+$/.test(rawStt)) return true;
  }

  // Một số sheet không dùng STT hoặc để trống STT ở học viên mới.
  // Nếu cột tên đã có tên hợp lệ thì ưu tiên coi đây là dòng dữ liệu thay vì
  // âm thầm nuốt dòng đầu tiên làm "field header".
  return true;
}

function findStudentHeaderRow(rows) {
  const max = Math.min(rows.length, 80);
  for (let i = 0; i < max; i += 1) {
    const normalized = rows[i].map(normalizeText);
    const stt = normalized.findIndex((v) => v === 'stt' || v === 'tt');
    const name = normalized.findIndex((v) => v === 'ho va ten' || v === 'ho ten' || v.includes('ho va ten'));
    if (name >= 0 && (stt >= 0 || normalized.length > 2)) {
      const hasDatesOnAnchor = rows[i].some((value, index) => index > name && Boolean(extractDate(value)));

      if (hasDatesOnAnchor) {
        const nextRow = rows[i + 1] || [];
        const nextRowIsStudent = looksLikeStudentDataRow(nextRow, stt, name);

        // Có hai layout thực tế:
        // A) date/header row -> field row -> student rows
        // B) single header row (date + field) -> student rows
        // v0.24.2 luôn giả định A nên layout B bị bỏ mất học viên đầu tiên.
        if (nextRowIsStudent) {
          return {
            rowIndex: i,
            sttIndex: stt,
            nameIndex: name,
            dateRowIndex: i,
            fieldRowIndex: i,
            dataStartIndex: i + 1,
            headerLayout: 'SINGLE_ROW',
          };
        }

        return {
          rowIndex: i,
          sttIndex: stt,
          nameIndex: name,
          dateRowIndex: i,
          fieldRowIndex: Math.min(i + 1, rows.length - 1),
          dataStartIndex: i + 2,
          headerLayout: 'DATE_THEN_FIELD',
        };
      }

      return {
        rowIndex: i,
        sttIndex: stt,
        nameIndex: name,
        dateRowIndex: Math.max(0, i - 1),
        fieldRowIndex: i,
        dataStartIndex: i + 1,
        headerLayout: 'FIELD_WITH_DATE_ABOVE',
      };
    }
  }
  throw new Error('Không tìm thấy dòng tiêu đề có cột "Họ và Tên" trong Google Sheet.');
}

function buildColumnMeta(rows, headerInfo) {
  const fieldRow = rows[headerInfo.fieldRowIndex] || [];
  const dateRow = rows[headerInfo.dateRowIndex] || [];
  const maxColumns = Math.max(fieldRow.length, dateRow.length);
  const columns = [];

  const explicitDates = [];
  for (let i = 0; i < maxColumns; i += 1) {
    const detected = extractDate(dateRow[i]);
    if (detected) explicitDates.push({ index: i, date: detected });
  }

  let currentDate = null;
  let currentDateIndex = -1;
  let nextExplicitPointer = 0;
  let currentFieldGroupTitle = null;
  let currentFieldGroupStart = -1;
  let previousRawGroupTitle = null;

  for (let i = 0; i < maxColumns; i += 1) {
    while (nextExplicitPointer < explicitDates.length && explicitDates[nextExplicitPointer].index < i) {
      nextExplicitPointer += 1;
    }

    const detected = extractDate(dateRow[i]);
    if (detected) {
      if (detected !== currentDate) {
        currentFieldGroupTitle = null;
        currentFieldGroupStart = -1;
        previousRawGroupTitle = null;
      }
      currentDate = detected;
      currentDateIndex = i;
      if (nextExplicitPointer < explicitDates.length && explicitDates[nextExplicitPointer].index === i) {
        nextExplicitPointer += 1;
      }
    }

    if (i === headerInfo.sttIndex || i === headerInfo.nameIndex) continue;

    const rawFieldName = String(fieldRow[i] ?? '').trim();
    const dateHeader = String(dateRow[i] ?? '').trim();
    let explicitFieldName = rawFieldName;
    if (headerInfo.fieldRowIndex === headerInfo.dateRowIndex) {
      // Single-row header: ví dụ "07.09.2026 Điểm danh". Bỏ phần ngày
      // khỏi tên field để classification/assessment title không bị nhiễu.
      explicitFieldName = rawFieldName
        .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/g, '')
        .trim();
    }

    if (explicitFieldName) {
      const normalizedTitle = normalizeText(explicitFieldName);
      // Google can export merged cells either with only the first title cell populated
      // or with the same title repeated. Adjacent identical titles stay in one group.
      if (!currentFieldGroupTitle || normalizedTitle !== previousRawGroupTitle) {
        currentFieldGroupTitle = explicitFieldName;
        currentFieldGroupStart = i;
      }
      previousRawGroupTitle = normalizedTitle;
    }

    if (!explicitFieldName && !currentDate && !currentFieldGroupTitle) continue;

    const fieldName = explicitFieldName || `Cột ${i + 1}`;
    const hasNextExplicitDate = explicitDates.some((entry) => entry.index > currentDateIndex);
    let dateConfidence = null;
    if (currentDate) {
      if (i === currentDateIndex) dateConfidence = 'EXPLICIT';
      else if (hasNextExplicitDate) dateConfidence = 'BOUNDED_FORWARD_FILL';
      else dateConfidence = 'UNBOUNDED_LAST_GROUP';
    }

    columns.push({
      index: i,
      observedOn: currentDate,
      fieldName,
      rawFieldName: explicitFieldName,
      fieldGroupTitle: currentFieldGroupTitle || fieldName,
      fieldGroupStartIndex: currentFieldGroupStart >= 0 ? currentFieldGroupStart : i,
      rawDateHeader: dateHeader,
      dateConfidence,
    });
  }

  const groupEnds = new Map();
  for (const col of columns) {
    const key = `${col.observedOn || ''}|${col.fieldGroupStartIndex}`;
    groupEnds.set(key, col.index);
  }
  for (const col of columns) {
    const key = `${col.observedOn || ''}|${col.fieldGroupStartIndex}`;
    col.fieldGroupEndIndex = groupEnds.get(key) ?? col.index;
  }

  return columns;
}

function isAssessmentField(fieldName) {
  const n = normalizeText(fieldName);
  if (!n) return false;
  if (/\b(diem danh|attendance|cambridge|cefr|luu y|ghi chu|nhan xet|chu y|note)\b/.test(n)) return false;
  if (/\b(btvn|homework|workbook)\b/.test(n)) return false;
  return Boolean(
    extractHeaderMax(fieldName) !== null ||
    /\b(test|kiem tra|quiz|pet|unit|reading|listening|grammar|tenses?|vocabulary|tu vung|score|diem)\b/.test(n)
  );
}

function detectAssessmentType(fieldName) {
  const n = normalizeText(fieldName);
  if (/\b(quiz)\b/.test(n)) return 'QUIZ';
  if (/\b(bai tap|exercise|practice)\b/.test(n)) return 'PRACTICE';
  if (/\b(test|kiem tra|pet|unit)\b/.test(n)) return 'TEST';
  return 'PRACTICE';
}

function makeAssessmentKey(sourceId, observedOn, startIndex, endIndex, title) {
  const input = [sourceId, observedOn || '', startIndex, endIndex, normalizeText(title)].join('|');
  return crypto.createHash('sha256').update(input).digest('hex');
}

function buildAssessmentGroups(columns, sourceId = 0) {
  const grouped = new Map();
  for (const col of columns) {
    const title = col.fieldGroupTitle || col.fieldName;
    if (!isAssessmentField(title)) continue;
    const mapKey = `${col.observedOn || ''}|${col.fieldGroupStartIndex}|${normalizeText(title)}`;
    if (!grouped.has(mapKey)) {
      grouped.set(mapKey, {
        observedOn: col.observedOn,
        title,
        assessmentType: detectAssessmentType(title),
        skillCode: detectSkill(title),
        rawMaxScore: extractHeaderMax(title),
        sourceColumnStart: col.fieldGroupStartIndex,
        sourceColumnEnd: col.fieldGroupEndIndex,
        dateConfidence: col.dateConfidence,
        columns: [],
      });
    }
    const group = grouped.get(mapKey);
    group.columns.push(col);
    group.sourceColumnEnd = Math.max(group.sourceColumnEnd, col.index);
    if (col.dateConfidence === 'UNBOUNDED_LAST_GROUP') group.dateConfidence = 'UNBOUNDED_LAST_GROUP';
  }

  return [...grouped.values()].map((group) => ({
    ...group,
    externalAssessmentKey: makeAssessmentKey(
      sourceId,
      group.observedOn,
      group.sourceColumnStart,
      group.sourceColumnEnd,
      group.title,
    ),
  }));
}

function inferAssessmentResult(group, row) {
  const cells = group.columns
    .map((col) => ({
      index: col.index,
      rawValue: String(row[col.index] ?? '').trim(),
      numeric: parseNumber(row[col.index]),
      fraction: parseFraction(row[col.index]),
    }))
    .filter((cell) => cell.rawValue !== '');

  if (!cells.length) return null;

  const fractionCell = cells.find((cell) => cell.fraction);
  if (fractionCell) {
    const { score, max } = fractionCell.fraction;
    return {
      rawScore: score,
      rawMaxScore: max,
      normalizedScore: roundScore((score / max) * 10),
      normalizedMaxScore: 10,
      confidence: 100,
      detectionMode: 'FRACTION',
      primaryColumnIndex: fractionCell.index,
      warning: score < 0 || score > max ? `Điểm ${score}/${max} không hợp lệ.` : null,
      rawValues: cells.map(({ index, rawValue }) => ({ index, value: rawValue })),
    };
  }

  const numericCells = cells.filter((cell) => cell.numeric !== null);
  if (!numericCells.length) return null;

  const headerMax = group.rawMaxScore;
  if (headerMax !== null) {
    let bestPair = null;
    for (const normalizedCell of numericCells) {
      if (normalizedCell.numeric < 0 || normalizedCell.numeric > 10) continue;
      for (const rawCell of numericCells) {
        if (rawCell.index === normalizedCell.index) continue;
        if (rawCell.numeric < 0 || rawCell.numeric > headerMax) continue;
        const expected = (rawCell.numeric / headerMax) * 10;
        const diff = Math.abs(normalizedCell.numeric - expected);
        if (diff <= 0.16 && (!bestPair || diff < bestPair.diff || (diff === bestPair.diff && rawCell.index > normalizedCell.index))) {
          bestPair = { normalizedCell, rawCell, diff };
        }
      }
    }

    if (bestPair) {
      return {
        rawScore: bestPair.rawCell.numeric,
        rawMaxScore: headerMax,
        normalizedScore: bestPair.normalizedCell.numeric,
        normalizedMaxScore: 10,
        confidence: 100,
        detectionMode: 'NORMALIZED_RAW_PAIR_WITH_HEADER_MAX',
        primaryColumnIndex: bestPair.normalizedCell.index,
        warning: null,
        rawValues: cells.map(({ index, rawValue }) => ({ index, value: rawValue })),
      };
    }

    const rawCell = [...numericCells]
      .reverse()
      .find((cell) => cell.numeric >= 0 && cell.numeric <= headerMax);
    if (rawCell) {
      return {
        rawScore: rawCell.numeric,
        rawMaxScore: headerMax,
        normalizedScore: roundScore((rawCell.numeric / headerMax) * 10),
        normalizedMaxScore: 10,
        confidence: 92,
        detectionMode: 'RAW_WITH_HEADER_MAX',
        primaryColumnIndex: rawCell.index,
        warning: null,
        rawValues: cells.map(({ index, rawValue }) => ({ index, value: rawValue })),
      };
    }

    return {
      rawScore: null,
      rawMaxScore: headerMax,
      normalizedScore: null,
      normalizedMaxScore: 10,
      confidence: 0,
      detectionMode: 'INVALID_HEADER_MAX_SCORE',
      primaryColumnIndex: numericCells[0].index,
      warning: `Không xác định được điểm hợp lệ trên thang ${headerMax}.`,
      rawValues: cells.map(({ index, rawValue }) => ({ index, value: rawValue })),
    };
  }

  // No explicit denominator: infer it only when the sheet provides a normalized /10
  // value and a raw correct-answer count that are mathematically consistent.
  let inferredPair = null;
  for (const normalizedCell of numericCells) {
    const n = normalizedCell.numeric;
    if (!(n > 0 && n <= 10)) continue;
    for (const rawCell of numericCells) {
      const r = rawCell.numeric;
      if (rawCell.index === normalizedCell.index || !(r > 10)) continue;
      const inferredMax = (r * 10) / n;
      const roundedMax = Math.round(inferredMax);
      const diff = Math.abs(inferredMax - roundedMax);
      if (roundedMax < r || roundedMax > 200 || diff > 0.08) continue;
      const scoreDiff = Math.abs(n - (r / roundedMax) * 10);
      if (scoreDiff > 0.16) continue;
      if (!inferredPair || diff < inferredPair.diff) {
        inferredPair = { normalizedCell, rawCell, rawMax: roundedMax, diff };
      }
    }
  }

  if (inferredPair) {
    return {
      rawScore: inferredPair.rawCell.numeric,
      rawMaxScore: inferredPair.rawMax,
      normalizedScore: inferredPair.normalizedCell.numeric,
      normalizedMaxScore: 10,
      confidence: 95,
      detectionMode: 'NORMALIZED_RAW_PAIR_INFERRED_MAX',
      primaryColumnIndex: inferredPair.normalizedCell.index,
      warning: null,
      rawValues: cells.map(({ index, rawValue }) => ({ index, value: rawValue })),
    };
  }

  const normalizedOnly = numericCells.find((cell) => cell.numeric >= 0 && cell.numeric <= 10);
  if (normalizedOnly) {
    return {
      rawScore: null,
      rawMaxScore: null,
      normalizedScore: normalizedOnly.numeric,
      normalizedMaxScore: 10,
      confidence: 80,
      detectionMode: 'NORMALIZED_ONLY',
      primaryColumnIndex: normalizedOnly.index,
      warning: null,
      rawValues: cells.map(({ index, rawValue }) => ({ index, value: rawValue })),
    };
  }

  return {
    rawScore: null,
    rawMaxScore: null,
    normalizedScore: null,
    normalizedMaxScore: 10,
    confidence: 0,
    detectionMode: 'UNRESOLVED_NUMERIC',
    primaryColumnIndex: numericCells[0].index,
    warning: 'Có dữ liệu số nhưng chưa xác định được thang điểm; chỉ lưu staging.',
    rawValues: cells.map(({ index, rawValue }) => ({ index, value: rawValue })),
  };
}

function buildExternalStudentKey(name, stt, occurrence = 1) {
  const normalized = normalizeName(name);
  const stable = normalized || `row-${String(stt ?? '').trim() || 'unknown'}`;
  return occurrence > 1 ? `name:${stable}#${occurrence}` : `name:${stable}`;
}

function makeObservationKey(sourceId, externalStudentKey, observedOn, columnIndex, fieldName) {
  const input = [sourceId, externalStudentKey, observedOn || '', columnIndex, normalizeText(fieldName)].join('|');
  return crypto.createHash('sha256').update(input).digest('hex');
}

function parseTeacherTrackingSheet(csvText, { sourceId = 0 } = {}) {
  const rows = parseCsv(csvText);
  const headerInfo = findStudentHeaderRow(rows);
  const columns = buildColumnMeta(rows, headerInfo);
  const assessments = buildAssessmentGroups(columns, sourceId);
  const assessmentByColumn = new Map();
  for (const assessment of assessments) {
    for (const col of assessment.columns) assessmentByColumn.set(col.index, assessment);
  }

  const students = [];
  const occurrences = new Map();

  for (let r = headerInfo.dataStartIndex; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const rawName = String(row[headerInfo.nameIndex] ?? '').trim();
    const normalized = normalizeName(rawName);
    const stt = headerInfo.sttIndex >= 0 ? String(row[headerInfo.sttIndex] ?? '').trim() : '';
    const hasValidName = Boolean(normalized) && !['ho va ten', 'ho ten'].includes(normalized);

    let externalStudentKey;
    let externalStudentName;

    if (hasValidName) {
      const occurrence = (occurrences.get(normalized) || 0) + 1;
      occurrences.set(normalized, occurrence);
      externalStudentKey = buildExternalStudentKey(rawName, stt, occurrence);
      externalStudentName = rawName;
    } else {
      // Không được âm thầm bỏ một hàng có dữ liệu chỉ vì ô Họ và Tên trống
      // (thường xảy ra khi giáo viên merge cell hoặc mới thêm học viên nhưng chưa điền STT).
      // Dùng row-key staging-only để giáo viên có thể nhìn thấy và mapping thủ công.
      externalStudentKey = `row:${r + 1}`;
      externalStudentName = `Dòng ${r + 1} (chưa có Họ và Tên)`;
    }

    const observations = [];
    for (const col of columns) {
      const rawValue = String(row[col.index] ?? '').trim();
      if (!rawValue) continue;

      const assessment = assessmentByColumn.get(col.index) || null;
      const classification = classifyObservation(assessment?.title || col.fieldName, rawValue);
      observations.push({
        externalStudentKey,
        observedOn: col.observedOn,
        sourceColumnIndex: col.index,
        fieldName: col.fieldName,
        assessmentTitle: assessment?.title || null,
        assessmentKey: assessment?.externalAssessmentKey || null,
        rawDateHeader: col.rawDateHeader,
        dateConfidence: col.dateConfidence,
        rawValue,
        observationType: classification.type,
        skillCode: classification.skillCode,
        numericValue: classification.numericValue,
        maxValue: classification.maxValue,
        normalizedStatus: classification.normalizedStatus,
        observationKey: makeObservationKey(
          sourceId,
          externalStudentKey,
          col.observedOn,
          col.index,
          col.fieldName,
        ),
      });
    }

    const assessmentResults = [];
    for (const assessment of assessments) {
      const result = inferAssessmentResult(assessment, row);
      if (!result) continue;
      const primaryObservation = observations.find((obs) => obs.sourceColumnIndex === result.primaryColumnIndex);
      assessmentResults.push({
        externalAssessmentKey: assessment.externalAssessmentKey,
        observedOn: assessment.observedOn,
        title: assessment.title,
        assessmentType: assessment.assessmentType,
        skillCode: assessment.skillCode,
        sourceColumnStart: assessment.sourceColumnStart,
        sourceColumnEnd: assessment.sourceColumnEnd,
        dateConfidence: assessment.dateConfidence,
        rawScore: result.rawScore,
        rawMaxScore: result.rawMaxScore,
        normalizedScore: result.normalizedScore,
        normalizedMaxScore: result.normalizedMaxScore,
        confidence: result.confidence,
        detectionMode: result.detectionMode,
        warning: result.warning,
        rawValues: result.rawValues,
        primaryObservationKey: primaryObservation?.observationKey || null,
        primaryColumnIndex: result.primaryColumnIndex,
      });
    }

    // v0.24.2: nếu có Họ và Tên hợp lệ thì luôn giữ học viên trong danh sách
    // dù chưa có STT/điểm. Điều này cho phép tạo external_student_links và auto-match.
    // Với hàng thiếu tên, chỉ giữ khi có STT hoặc có dữ liệu thực tế để tránh biến
    // các dòng trang trí/trống thành "học viên" giả.
    if (!hasValidName && observations.length === 0 && assessmentResults.length === 0 && !stt) continue;

    students.push({
      externalStudentKey,
      externalStudentName,
      externalRowHint: stt || String(r + 1),
      sourceRowIndex: r,
      missingName: !hasValidName,
      observations,
      assessmentResults,
    });
  }

  return {
    rowsRead: rows.length,
    headerRowIndex: headerInfo.rowIndex,
    columns,
    assessments: assessments.map(({ columns: assessmentColumns, ...assessment }) => ({
      ...assessment,
      sourceColumns: assessmentColumns.map((col) => col.index),
    })),
    students,
  };
}

module.exports = {
  parseCsv,
  normalizeText,
  normalizeName,
  extractDate,
  extractHeaderMax,
  parseFraction,
  parseNumber,
  detectSkill,
  normalizeAttendance,
  normalizeHomework,
  classifyObservation,
  findStudentHeaderRow,
  buildColumnMeta,
  isAssessmentField,
  detectAssessmentType,
  buildAssessmentGroups,
  inferAssessmentResult,
  makeAssessmentKey,
  makeObservationKey,
  parseTeacherTrackingSheet,
};
