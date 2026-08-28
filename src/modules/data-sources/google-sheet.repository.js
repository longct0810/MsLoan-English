'use strict';

function createGoogleSheetRepository(pool) {
  if (!pool || typeof pool.query !== 'function') {
    throw new Error('GoogleSheetRepository cần một pg Pool/Client hợp lệ.');
  }

  const query = (db, text, params = []) => (db || pool).query(text, params);

  return {
    async listTeacherSources(teacherId) {
      const { rows } = await pool.query(`
        SELECT s.*,
               c.name AS class_name,
               c.school_year,
               (SELECT COUNT(*) FROM external_student_links l
                 WHERE l.source_id=s.id AND l.match_status='MATCHED') AS matched_students,
               (SELECT COUNT(*) FROM external_student_links l
                 WHERE l.source_id=s.id AND l.match_status<>'MATCHED') AS unmatched_students
          FROM external_data_sources s
          JOIN classes c ON c.id=s.class_id
         WHERE s.teacher_id=$1
         ORDER BY s.enabled DESC, s.updated_at DESC, s.id DESC
      `, [teacherId]);
      return rows;
    },

    async listTeacherClasses(teacherId) {
      const { rows } = await pool.query(`
        SELECT id,name,school_year,grade_id,status
          FROM classes
         WHERE teacher_id=$1
           AND deleted_at IS NULL
         ORDER BY school_year DESC,name
      `, [teacherId]);
      return rows;
    },

    async getSource(sourceId, teacherId = null, db = null) {
      const params = [sourceId];
      let ownerClause = '';
      if (teacherId != null) {
        params.push(teacherId);
        ownerClause = ` AND s.teacher_id=$${params.length}`;
      }
      const { rows } = await query(db, `
        SELECT s.*, c.name AS class_name, c.school_year
          FROM external_data_sources s
          JOIN classes c ON c.id=s.class_id
         WHERE s.id=$1 ${ownerClause}
         LIMIT 1
      `, params);
      return rows[0] || null;
    },

    async createSource({ teacherId, classId, name, spreadsheetId, sheetGid, sourceUrl, intervalMinutes, importFromDate }) {
      const classCheck = await pool.query(`
        SELECT id,school_year FROM classes
         WHERE id=$1 AND teacher_id=$2 AND deleted_at IS NULL
         LIMIT 1
      `, [classId, teacherId]);
      if (!classCheck.rows[0]) throw new Error('Lớp không tồn tại hoặc không thuộc giáo viên hiện tại.');

      let effectiveImportFromDate = importFromDate || null;
      if (!effectiveImportFromDate) {
        const yearMatch = String(classCheck.rows[0].school_year || '').match(/(\d{4})/);
        if (yearMatch) effectiveImportFromDate = `${yearMatch[1]}-01-01`;
      }

      const { rows } = await pool.query(`
        INSERT INTO external_data_sources(
          teacher_id,class_id,provider,name,spreadsheet_id,sheet_gid,source_url,
          enabled,sync_interval_minutes,import_from_date,settings
        ) VALUES($1,$2,'GOOGLE_SHEETS',$3,$4,$5,$6,TRUE,$7,$8,
          jsonb_build_object(
            'materialize_scores',TRUE,
            'materialize_attendance',TRUE,
            'materialize_notes',TRUE,
            'materialize_skill_events',TRUE,
            'auto_create_session',TRUE,
            'skip_future_dates',TRUE
          )
        )
        ON CONFLICT(teacher_id,class_id,provider,spreadsheet_id,sheet_gid)
        DO UPDATE SET
          name=EXCLUDED.name,
          source_url=EXCLUDED.source_url,
          enabled=TRUE,
          sync_interval_minutes=EXCLUDED.sync_interval_minutes,
          import_from_date=COALESCE(EXCLUDED.import_from_date,external_data_sources.import_from_date),
          updated_at=NOW()
        RETURNING *
      `, [teacherId, classId, name, spreadsheetId, String(sheetGid || '0'), sourceUrl, intervalMinutes || 15, effectiveImportFromDate]);
      return rows[0];
    },

    async updateSourceState(sourceId, fields, db = null) {
      const allowed = {
        last_content_hash: 'last_content_hash',
        last_synced_at: 'last_synced_at',
        last_success_at: 'last_success_at',
        last_error: 'last_error',
        enabled: 'enabled',
      };
      const sets = [];
      const values = [];
      for (const [key, column] of Object.entries(allowed)) {
        if (!(key in fields)) continue;
        values.push(fields[key]);
        sets.push(`${column}=$${values.length}`);
      }
      if (!sets.length) return;
      values.push(sourceId);
      await query(db, `UPDATE external_data_sources SET ${sets.join(',')},updated_at=NOW() WHERE id=$${values.length}`, values);
    },

    async listDueSources() {
      const { rows } = await pool.query(`
        SELECT * FROM external_data_sources
         WHERE enabled=TRUE
           AND (
             last_synced_at IS NULL OR
             last_synced_at + (sync_interval_minutes::text || ' minutes')::interval <= NOW()
           )
         ORDER BY COALESCE(last_synced_at,'1970-01-01'::timestamptz),id
      `);
      return rows;
    },

    async createRun(sourceId, triggerType, db = null) {
      const { rows } = await query(db, `
        INSERT INTO external_sync_runs(source_id,status,trigger_type)
        VALUES($1,'RUNNING',$2)
        RETURNING *
      `, [sourceId, triggerType]);
      return rows[0];
    },

    async finishRun(runId, stats, db = null) {
      await query(db, `
        UPDATE external_sync_runs SET
          status=$2, finished_at=NOW(), content_hash=$3,
          rows_read=$4, students_seen=$5, students_matched=$6,
          observations_seen=$7, observations_inserted=$8, observations_updated=$9,
          materialized_scores=$10, materialized_attendance=$11, materialized_notes=$12,
          skipped=$13, errors_count=$14, message=$15, details=$16::jsonb
         WHERE id=$1
      `, [
        runId,
        stats.status,
        stats.contentHash || null,
        stats.rowsRead || 0,
        stats.studentsSeen || 0,
        stats.studentsMatched || 0,
        stats.observationsSeen || 0,
        stats.observationsInserted || 0,
        stats.observationsUpdated || 0,
        stats.materializedScores || 0,
        stats.materializedAttendance || 0,
        stats.materializedNotes || 0,
        stats.skipped || 0,
        stats.errorsCount || 0,
        stats.message || null,
        JSON.stringify(stats.details || {}),
      ]);
    },

    async acquireSourceLock(client, sourceId) {
      const { rows } = await client.query(
        `SELECT pg_try_advisory_xact_lock(hashtextextended('google-sheet:' || $1::text,0)) AS locked`,
        [sourceId],
      );
      return Boolean(rows[0]?.locked);
    },

    async getClassStudents(classId, db = null) {
      const { rows } = await query(db, `
        SELECT s.id,s.full_name,s.status
          FROM class_students cs
          JOIN students s ON s.id=cs.student_id
         WHERE cs.class_id=$1
           AND cs.status='ACTIVE'
           AND s.status='ACTIVE'
           AND s.deleted_at IS NULL
         ORDER BY s.full_name,s.id
      `, [classId]);
      return rows;
    },

    async getStudentLink(sourceId, externalKey, db = null) {
      const { rows } = await query(db, `
        SELECT * FROM external_student_links
         WHERE source_id=$1 AND external_student_key=$2
         LIMIT 1
      `, [sourceId, externalKey]);
      return rows[0] || null;
    },

    async upsertStudentLink(data, db = null) {
      const { rows } = await query(db, `
        INSERT INTO external_student_links(
          source_id,external_student_key,external_student_name,external_row_hint,
          student_id,match_status,match_method,confidence,last_seen_at
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW())
        ON CONFLICT(source_id,external_student_key)
        DO UPDATE SET
          external_student_name=EXCLUDED.external_student_name,
          external_row_hint=EXCLUDED.external_row_hint,
          student_id=CASE
            WHEN external_student_links.match_method='MANUAL' THEN external_student_links.student_id
            ELSE EXCLUDED.student_id
          END,
          match_status=CASE
            WHEN external_student_links.match_method='MANUAL' THEN external_student_links.match_status
            ELSE EXCLUDED.match_status
          END,
          match_method=CASE
            WHEN external_student_links.match_method='MANUAL' THEN external_student_links.match_method
            ELSE EXCLUDED.match_method
          END,
          confidence=CASE
            WHEN external_student_links.match_method='MANUAL' THEN external_student_links.confidence
            ELSE EXCLUDED.confidence
          END,
          last_seen_at=NOW(),updated_at=NOW()
        RETURNING *
      `, [
        data.sourceId,
        data.externalStudentKey,
        data.externalStudentName,
        data.externalRowHint || null,
        data.studentId || null,
        data.matchStatus,
        data.matchMethod || null,
        data.confidence || null,
      ]);
      return rows[0];
    },

    async manualLinkStudent({ sourceId, externalKey, studentId, teacherId }) {
      const allowed = await pool.query(`
        SELECT 1
          FROM external_data_sources src
          JOIN class_students cs ON cs.class_id=src.class_id AND cs.student_id=$3 AND cs.status='ACTIVE'
          JOIN students s ON s.id=cs.student_id AND s.deleted_at IS NULL
         WHERE src.id=$1 AND src.teacher_id=$2
         LIMIT 1
      `, [sourceId, teacherId, studentId]);
      if (!allowed.rows[0]) throw new Error('Học sinh không thuộc lớp của nguồn dữ liệu.');

      const { rows } = await pool.query(`
        UPDATE external_student_links
           SET student_id=$3,match_status='MATCHED',match_method='MANUAL',confidence=100,updated_at=NOW()
         WHERE source_id=$1 AND external_student_key=$2
         RETURNING *
      `, [sourceId, externalKey, studentId]);
      return rows[0] || null;
    },

    async upsertObservation(data, db = null) {
      const existing = await query(db, `
        SELECT id FROM external_observations
         WHERE source_id=$1 AND observation_key=$2
         LIMIT 1
      `, [data.sourceId, data.observationKey]);
      const inserted = !existing.rows[0];

      const { rows } = await query(db, `
        INSERT INTO external_observations(
          source_id,sync_run_id,external_student_key,student_id,class_id,observed_on,
          source_column_index,field_name,observation_type,skill_code,raw_value,
          numeric_value,max_value,normalized_status,observation_key,payload,warning,
          active,first_seen_at,last_seen_at
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,TRUE,NOW(),NOW())
        ON CONFLICT(source_id,observation_key)
        DO UPDATE SET
          sync_run_id=EXCLUDED.sync_run_id,
          student_id=COALESCE(EXCLUDED.student_id,external_observations.student_id),
          class_id=EXCLUDED.class_id,
          observed_on=EXCLUDED.observed_on,
          field_name=EXCLUDED.field_name,
          observation_type=EXCLUDED.observation_type,
          skill_code=EXCLUDED.skill_code,
          raw_value=EXCLUDED.raw_value,
          numeric_value=EXCLUDED.numeric_value,
          max_value=EXCLUDED.max_value,
          normalized_status=EXCLUDED.normalized_status,
          payload=EXCLUDED.payload,
          warning=EXCLUDED.warning,
          active=TRUE,
          last_seen_at=NOW(),updated_at=NOW()
        RETURNING *
      `, [
        data.sourceId,
        data.syncRunId,
        data.externalStudentKey,
        data.studentId || null,
        data.classId,
        data.observedOn || null,
        data.sourceColumnIndex,
        data.fieldName || null,
        data.observationType,
        data.skillCode || null,
        data.rawValue,
        data.numericValue,
        data.maxValue,
        data.normalizedStatus || null,
        data.observationKey,
        JSON.stringify(data.payload || {}),
        data.warning || null,
      ]);
      return { observation: rows[0], inserted };
    },

    async ensureSessionLink({ source, observedOn, autoCreateSession }, db) {
      if (!observedOn) return { session: null, warning: 'Không có ngày để gắn buổi học.' };

      const linked = await query(db, `
        SELECT cs.*
          FROM external_session_links l
          JOIN class_sessions cs ON cs.id=l.class_session_id
         WHERE l.source_id=$1 AND l.observed_on=$2
         LIMIT 1
      `, [source.id, observedOn]);
      if (linked.rows[0]) return { session: linked.rows[0], warning: null };

      const existing = await query(db, `
        SELECT * FROM class_sessions
         WHERE class_id=$1 AND session_date=$2 AND status<>'CANCELLED'
         ORDER BY id
      `, [source.class_id, observedOn]);

      if (existing.rows.length === 1) {
        const session = existing.rows[0];
        await query(db, `
          INSERT INTO external_session_links(source_id,observed_on,class_session_id,link_method)
          VALUES($1,$2,$3,'AUTO')
          ON CONFLICT(source_id,observed_on) DO NOTHING
        `, [source.id, observedOn, session.id]);
        return { session, warning: null };
      }

      if (existing.rows.length > 1) {
        return { session: null, warning: 'Có nhiều buổi học cùng ngày; cần chọn buổi học thủ công.' };
      }

      if (!autoCreateSession) {
        return { session: null, warning: 'Chưa có buổi học tương ứng và auto_create_session đang tắt.' };
      }

      const created = await query(db, `
        INSERT INTO class_sessions(
          class_id,teacher_id,session_date,topic,lesson_summary,status,
          teacher_summary,parent_published,completed_at,completed_by
        ) VALUES(
          $1,$2,$3,'Theo dõi lớp - Google Sheets',
          'Buổi học được tạo tự động từ dữ liệu điểm danh Google Sheets.',
          'COMPLETED',
          'Đồng bộ tự động từ nguồn theo dõi Google Sheets.',FALSE,NOW(),$2
        )
        RETURNING *
      `, [source.class_id, source.teacher_id, observedOn]);
      const session = created.rows[0];
      await query(db, `
        INSERT INTO external_session_links(source_id,observed_on,class_session_id,link_method)
        VALUES($1,$2,$3,'CREATED_BY_SYNC')
        ON CONFLICT(source_id,observed_on) DO NOTHING
      `, [source.id, observedOn, session.id]);
      return { session, warning: null };
    },

    async materializeScore({ observation, source }, db) {
      const ref = `external-observation:${observation.id}`;
      const title = String(observation.field_name || 'Google Sheets').slice(0, 250);
      const category = observation.skill_code || 'GOOGLE_SHEETS';
      const { rows } = await query(db, `
        INSERT INTO student_scores(
          student_id,class_id,title,category,score,max_score,recorded_at,
          source_type,source_ref,source_payload
        ) VALUES($1,$2,$3,$4,$5,$6,$7,'GOOGLE_SHEETS',$8,$9::jsonb)
        ON CONFLICT(student_id,source_type,source_ref) WHERE source_ref IS NOT NULL
        DO UPDATE SET
          class_id=EXCLUDED.class_id,title=EXCLUDED.title,category=EXCLUDED.category,
          score=EXCLUDED.score,max_score=EXCLUDED.max_score,recorded_at=EXCLUDED.recorded_at,
          source_payload=EXCLUDED.source_payload
        RETURNING id
      `, [
        observation.student_id,
        source.class_id,
        title,
        category,
        observation.numeric_value,
        observation.max_value || 10,
        observation.observed_on,
        ref,
        JSON.stringify({ observationId: observation.id, sourceId: source.id }),
      ]);

      if (source.materializeSkillEvents !== false && observation.skill_code && observation.max_value > 0) {
        await query(db, `
          INSERT INTO student_skill_events(
            student_id,class_id,skill_code,source_type,source_id,score,max_score,weight,recorded_at
          ) VALUES($1,$2,$3,'EXTERNAL',$4,$5,$6,1,$7::date::timestamptz)
          ON CONFLICT(student_id,skill_code,source_type,source_id)
          DO UPDATE SET
            class_id=EXCLUDED.class_id,score=EXCLUDED.score,max_score=EXCLUDED.max_score,
            recorded_at=EXCLUDED.recorded_at
        `, [
          observation.student_id,
          source.class_id,
          observation.skill_code,
          observation.id,
          observation.numeric_value,
          observation.max_value,
          observation.observed_on,
        ]);
      }
      return rows[0]?.id || null;
    },

    async materializeNote({ observation, source, classSessionId = null }, db) {
      const ref = `external-observation:${observation.id}`;
      const { rows } = await query(db, `
        INSERT INTO teacher_notes(
          student_id,note,author_name,created_at,class_session_id,category,is_parent_visible,
          source_type,source_ref,source_payload
        ) VALUES($1,$2,'Google Sheets',$3,$4,'GOOGLE_SHEETS',FALSE,'GOOGLE_SHEETS',$5,$6::jsonb)
        ON CONFLICT(student_id,source_type,source_ref) WHERE source_ref IS NOT NULL
        DO UPDATE SET
          note=EXCLUDED.note,created_at=EXCLUDED.created_at,class_session_id=EXCLUDED.class_session_id,
          source_payload=EXCLUDED.source_payload,is_parent_visible=FALSE
        RETURNING id
      `, [
        observation.student_id,
        observation.raw_value,
        observation.observed_on,
        classSessionId,
        ref,
        JSON.stringify({ observationId: observation.id, sourceId: source.id, fieldName: observation.field_name }),
      ]);
      return rows[0]?.id || null;
    },

    async materializeAttendance({ observation, source, session }, db) {
      const existing = await query(db, `
        SELECT * FROM session_attendance WHERE session_id=$1 AND student_id=$2 LIMIT 1
      `, [session.id, observation.student_id]);

      if (existing.rows[0] && existing.rows[0].source_type !== 'GOOGLE_SHEETS') {
        return { updated: false, conflict: 'Điểm danh đã được nhập thủ công; không ghi đè.' };
      }

      await query(db, `
        INSERT INTO session_attendance(
          session_id,student_id,status,note,marked_at,source_type,source_ref,source_payload
        ) VALUES($1,$2,$3,$4,NOW(),'GOOGLE_SHEETS',$5,$6::jsonb)
        ON CONFLICT(session_id,student_id)
        DO UPDATE SET
          status=CASE WHEN session_attendance.source_type='GOOGLE_SHEETS' THEN EXCLUDED.status ELSE session_attendance.status END,
          note=CASE WHEN session_attendance.source_type='GOOGLE_SHEETS' THEN EXCLUDED.note ELSE session_attendance.note END,
          marked_at=CASE WHEN session_attendance.source_type='GOOGLE_SHEETS' THEN NOW() ELSE session_attendance.marked_at END,
          source_ref=CASE WHEN session_attendance.source_type='GOOGLE_SHEETS' THEN EXCLUDED.source_ref ELSE session_attendance.source_ref END,
          source_payload=CASE WHEN session_attendance.source_type='GOOGLE_SHEETS' THEN EXCLUDED.source_payload ELSE session_attendance.source_payload END
      `, [
        session.id,
        observation.student_id,
        observation.normalized_status,
        `Đồng bộ từ Google Sheets: ${observation.raw_value}`,
        `external-observation:${observation.id}`,
        JSON.stringify({ observationId: observation.id, sourceId: source.id }),
      ]);
      return { updated: true, conflict: null };
    },

    async getRecentRuns(sourceId, teacherId, limit = 30) {
      const { rows } = await pool.query(`
        SELECT r.*
          FROM external_sync_runs r
          JOIN external_data_sources s ON s.id=r.source_id
         WHERE r.source_id=$1 AND s.teacher_id=$2
         ORDER BY r.started_at DESC
         LIMIT $3
      `, [sourceId, teacherId, Math.min(Math.max(Number(limit) || 30, 1), 100)]);
      return rows;
    },

    async getUnmatchedStudents(sourceId, teacherId) {
      const { rows } = await pool.query(`
        SELECT l.*
          FROM external_student_links l
          JOIN external_data_sources s ON s.id=l.source_id
         WHERE l.source_id=$1 AND s.teacher_id=$2 AND l.match_status<>'MATCHED'
         ORDER BY l.external_student_name
      `, [sourceId, teacherId]);
      return rows;
    },
  };
}

module.exports = { createGoogleSheetRepository };
