'use strict';

function currentUser(req) {
  return req.user || req.session?.user || req.session?.authUser || null;
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

        const [runs, unmatched, classStudents] = await Promise.all([
          repository.getRecentRuns(sourceId, user.id, 50),
          repository.getUnmatchedStudents(sourceId, user.id),
          repository.getTeacherStudentsForMapping(user.id, source.class_id),
        ]);

        return res.render('teacher/data-sources/detail', {
          title: source.name,
          source,
          runs,
          unmatched,
          classStudents,
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
          force: req.body.force === '1',
        });
        const message = result.status === 'NO_CHANGE'
          ? 'Google Sheet chưa có thay đổi.'
          : `Đồng bộ ${result.status}: ${result.studentsMatched}/${result.studentsSeen} học sinh khớp, ${result.observationsSeen} ô dữ liệu.`;
        return res.redirect(`/teacher/data-sources/${sourceId}?message=${encodeURIComponent(message)}&type=${result.status === 'FAILED' ? 'danger' : 'success'}`);
      } catch (error) {
        const sourceId = Number(req.params.id);
        return res.redirect(`/teacher/data-sources/${sourceId}?message=${encodeURIComponent(error.message || 'Đồng bộ thất bại.')}&type=danger`);
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
