'use strict';

function currentUser(req) {
  return req.user || req.session?.user || req.session?.authUser || null;
}


function toZeroBasedIndex(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n - 1 : null;
}

function parseSheetProfileForm(body = {}) {
  const overrides = {};
  const rawOverrides = body.column_overrides && typeof body.column_overrides === 'object'
    ? body.column_overrides
    : {};

  for (const [indexRaw, item] of Object.entries(rawOverrides)) {
    const index = Number(indexRaw);
    if (!Number.isInteger(index) || index < 0 || !item || typeof item !== 'object') continue;
    const type = String(item.type || '').trim().toUpperCase();
    const fieldName = String(item.field_name || '').trim();
    const observedOn = String(item.observed_on || '').trim();
    if (!type && !fieldName && !observedOn) continue;
    overrides[String(index)] = {
      type: type || null,
      field_name: fieldName || null,
      observed_on: observedOn || null,
    };
  }

  return {
    version: 1,
    mode: String(body.mode || 'AUTO').trim().toUpperCase(),
    confirmed: body.confirmed === '1' || body.confirmed === 'true' || body.confirmed === 'on',
    header_row_index: toZeroBasedIndex(body.header_row),
    date_row_index: toZeroBasedIndex(body.date_row),
    field_row_index: toZeroBasedIndex(body.field_row),
    data_start_index: toZeroBasedIndex(body.data_start_row),
    stt_column_index: toZeroBasedIndex(body.stt_column),
    student_name_column_index: toZeroBasedIndex(body.student_name_column),
    attendance_aliases: String(body.attendance_aliases || '')
      .split(/[\n,;]/)
      .map((x) => x.trim())
      .filter(Boolean),
    column_overrides: overrides,
  };
}

function createGoogleSheetController({ repository, service }) {
  return {
    async index(req, res, next) {
      try {
        const user = currentUser(req);
        if (!user?.id) return res.status(401).send('Unauthorized');
        const [sources, classes] = await Promise.all([
          repository.listTeacherSources(user.id),
          repository.listTeacherClasses(user.id),
        ]);
        return res.render('teacher/data-sources/index', {
          title: 'Nguồn dữ liệu',
          sources,
          classes,
          flashMessage: req.query.message || null,
          flashType: req.query.type || 'info',
        });
      } catch (error) {
        return next(error);
      }
    },

    async create(req, res, next) {
      try {
        const user = currentUser(req);
        if (!user?.id) return res.status(401).send('Unauthorized');
        const classId = Number(req.body.class_id);
        if (!Number.isInteger(classId) || classId <= 0) throw new Error('Vui lòng chọn lớp.');
        if (!String(req.body.source_url || '').trim()) throw new Error('Vui lòng nhập Google Sheets URL.');

        const source = await service.createSource({
          teacherId: user.id,
          classId,
          name: req.body.name || 'Theo dõi lớp - Google Sheets',
          url: req.body.source_url,
          intervalMinutes: req.body.sync_interval_minutes || 15,
          importFromDate: req.body.import_from_date || null,
        });

        return res.redirect(`/teacher/data-sources/${source.id}?message=${encodeURIComponent('Đã thêm nguồn Google Sheets.')}&type=success`);
      } catch (error) {
        if (error?.code === '23505') {
          return res.redirect(`/teacher/data-sources?message=${encodeURIComponent('Nguồn Google Sheets này đã tồn tại cho lớp đã chọn.')}&type=warning`);
        }
        if (error?.message) {
          return res.redirect(`/teacher/data-sources?message=${encodeURIComponent(error.message)}&type=danger`);
        }
        return next(error);
      }
    },

    async detail(req, res, next) {
      try {
        const user = currentUser(req);
        if (!user?.id) return res.status(401).send('Unauthorized');
        const sourceId = Number(req.params.id);
        const source = await repository.getSource(sourceId, user.id);
        if (!source) return res.status(404).send('Không tìm thấy nguồn dữ liệu.');

        const [runs, unmatched, classStudents, assessments, assessmentTargets] = await Promise.all([
          repository.getRecentRuns(sourceId, user.id, 50),
          repository.getUnmatchedStudents(sourceId, user.id),
          repository.getTeacherStudentsForMapping(user.id, source.class_id),
          repository.listAssessmentsForSource(sourceId, user.id),
          repository.listAssessmentTargets(user.id, source.class_id),
        ]);

        return res.render('teacher/data-sources/detail', {
          title: source.name,
          source,
          runs,
          unmatched,
          classStudents,
          assessments,
          assessmentTargets,
          flashMessage: req.query.message || null,
          flashType: req.query.type || 'info',
        });
      } catch (error) {
        return next(error);
      }
    },

    async schemaProfile(req, res, next) {
      try {
        const user = currentUser(req);
        if (!user?.id) return res.status(401).send('Unauthorized');
        const sourceId = Number(req.params.id);
        const source = await repository.getSource(sourceId, user.id);
        if (!source) return res.status(404).send('Không tìm thấy nguồn dữ liệu.');
        const analysis = await service.inspectSource(sourceId, { teacherId: user.id });
        return res.render('teacher/data-sources/schema', {
          title: `Cấu trúc Sheet - ${source.name}`,
          source,
          analysis,
          profile: analysis.profile || source.settings?.sheet_profile || { mode: 'AUTO' },
          flashMessage: req.query.message || null,
          flashType: req.query.type || 'info',
        });
      } catch (error) {
        return next(error);
      }
    },

    async updateSchemaProfile(req, res, next) {
      try {
        const user = currentUser(req);
        if (!user?.id) return res.status(401).send('Unauthorized');
        const sourceId = Number(req.params.id);
        const profile = parseSheetProfileForm(req.body || {});
        const analysis = await service.saveSheetProfile(sourceId, { teacherId: user.id, profile });
        const message = profile.confirmed
          ? `Đã lưu và xác nhận cấu trúc Sheet: ${analysis.summary.studentsSeen} học viên, ${analysis.summary.attendanceObservations} ô điểm danh, ${analysis.summary.scoreObservations} ô điểm.`
          : 'Đã lưu cấu trúc Sheet ở chế độ chưa xác nhận. Dữ liệu sẽ chỉ staging cho đến khi xác nhận.';
        return res.redirect(`/teacher/data-sources/${sourceId}/schema?message=${encodeURIComponent(message)}&type=success`);
      } catch (error) {
        const sourceId = Number(req.params.id);
        return res.redirect(`/teacher/data-sources/${sourceId}/schema?message=${encodeURIComponent(error.message || 'Không thể lưu cấu trúc Sheet.')}&type=danger`);
      }
    },

    async assessmentDetail(req, res, next) {
      try {
        const user = currentUser(req);
        if (!user?.id) return res.status(401).send('Unauthorized');
        const sourceId = Number(req.params.id);
        const assessmentId = Number(req.params.assessmentId);
        const [source, assessment, results, skills] = await Promise.all([
          repository.getSource(sourceId, user.id),
          repository.getAssessmentDetail(sourceId, assessmentId, user.id),
          repository.listAssessmentResults(sourceId, assessmentId, user.id),
          repository.listSkills(),
        ]);
        if (!source || !assessment) return res.status(404).send('Không tìm thấy bài kiểm tra nguồn.');
        return res.render('teacher/data-sources/assessment-detail', {
          title: assessment.title,
          source,
          assessment,
          results,
          skills,
          flashMessage: req.query.message || null,
          flashType: req.query.type || 'info',
        });
      } catch (error) {
        return next(error);
      }
    },

    async syncNow(req, res, next) {
      try {
        const user = currentUser(req);
        if (!user?.id) return res.status(401).send('Unauthorized');
        const sourceId = Number(req.params.id);
        const result = await service.syncSource(sourceId, {
          triggerType: 'MANUAL',
          teacherId: user.id,
          // Nút "Đồng bộ ngay" là thao tác chủ động của giáo viên nên luôn re-process
          // dữ liệu, kể cả khi nội dung Sheet chưa đổi. Scheduler vẫn dùng content hash
          // để tránh tải/ghi lặp không cần thiết.
          force: req.body.force !== '0',
        });
        const message = result.status === 'NO_CHANGE'
          ? 'Google Sheet chưa có thay đổi.'
          : `Đồng bộ ${result.status}: ${result.studentsMatched}/${result.studentsSeen} học sinh khớp, ${result.observationsSeen} ô, ${result.assessmentsSeen || 0} bài test, ${result.materializedScores || 0} điểm đã ghi DB.`;
        return res.redirect(`/teacher/data-sources/${sourceId}?message=${encodeURIComponent(message)}&type=${result.status === 'FAILED' ? 'danger' : 'success'}`);
      } catch (error) {
        const sourceId = Number(req.params.id);
        return res.redirect(`/teacher/data-sources/${sourceId}?message=${encodeURIComponent(error.message || 'Đồng bộ thất bại.')}&type=danger`);
      }
    },


    async updateAssessmentSkill(req, res, next) {
      try {
        const user=currentUser(req);
        if(!user?.id) return res.status(401).send('Unauthorized');
        const sourceId=Number(req.params.id);
        const assessmentId=Number(req.params.assessmentId);
        await repository.manualSetAssessmentSkill({
          sourceId,assessmentId,teacherId:user.id,skillCode:req.body.skill_code||null,
        });
        return res.redirect(`/teacher/data-sources/${sourceId}/assessments/${assessmentId}?message=${encodeURIComponent('Đã cập nhật kỹ năng. Bấm Đồng bộ ngay ở nguồn dữ liệu để tái tạo chỉ số kỹ năng theo mapping mới.')}&type=success`);
      } catch(error){
        const sourceId=Number(req.params.id); const assessmentId=Number(req.params.assessmentId);
        return res.redirect(`/teacher/data-sources/${sourceId}/assessments/${assessmentId}?message=${encodeURIComponent(error.message||'Không thể cập nhật kỹ năng.')}&type=danger`);
      }
    },

    async linkAssessment(req, res, next) {
      try {
        const user = currentUser(req);
        if (!user?.id) return res.status(401).send('Unauthorized');
        const sourceId = Number(req.params.id);
        const assessmentId = Number(req.params.assessmentId);
        const mappingTarget = String(req.body.mapping_target || 'EXTERNAL').trim().toUpperCase();
        const [mappingTypeRaw, targetIdRaw] = mappingTarget.split(':', 2);
        const mappingType = mappingTypeRaw || 'EXTERNAL';
        const targetId = targetIdRaw ? Number(targetIdRaw) : null;
        if (!Number.isInteger(sourceId) || sourceId <= 0 || !Number.isInteger(assessmentId) || assessmentId <= 0) {
          throw new Error('Thông tin bài kiểm tra nguồn không hợp lệ.');
        }

        await repository.manualLinkAssessment({
          sourceId,
          assessmentId,
          teacherId: user.id,
          mappingType,
          targetId,
        });

        return res.redirect(`/teacher/data-sources/${sourceId}?message=${encodeURIComponent('Đã cập nhật liên kết bài kiểm tra. Lần đồng bộ kế tiếp sẽ áp dụng mapping này vào điểm học sinh.')}&type=success`);
      } catch (error) {
        const sourceId = Number(req.params.id);
        return res.redirect(`/teacher/data-sources/${sourceId}?message=${encodeURIComponent(error.message || 'Không thể liên kết bài kiểm tra.')}&type=danger`);
      }
    },

    async linkStudent(req, res, next) {
      try {
        const user = currentUser(req);
        if (!user?.id) return res.status(401).send('Unauthorized');
        const sourceId = Number(req.params.id);
        const externalKey = String(req.body.external_student_key || '').trim();
        const studentId = Number(req.body.student_id);
        if (!externalKey || !Number.isInteger(studentId) || studentId <= 0) {
          throw new Error('Thông tin mapping học sinh không hợp lệ.');
        }
        await repository.manualLinkStudent({ sourceId, externalKey, studentId, teacherId: user.id });
        return res.redirect(`/teacher/data-sources/${sourceId}?message=${encodeURIComponent('Đã liên kết học sinh. Nếu học sinh chưa thuộc lớp nguồn, hệ thống đã tự gán vào lớp này. Lần đồng bộ kế tiếp sẽ sử dụng mapping.')}&type=success`);
      } catch (error) {
        const sourceId = Number(req.params.id);
        return res.redirect(`/teacher/data-sources/${sourceId}?message=${encodeURIComponent(error.message || 'Không thể liên kết học sinh.')}&type=danger`);
      }
    },
  };
}

module.exports = { createGoogleSheetController };
