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
            'materialize_assessments',TRUE,
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
          assessments_seen=$13, assessment_results_seen=$14, materialized_assessment_results=$15,
          skipped=$16, errors_count=$17, message=$18, details=$19::jsonb
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
        stats.assessmentsSeen || 0,
        stats.assessmentResultsSeen || 0,
        stats.materializedAssessmentResults || 0,
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

    async getTeacherStudentsForMapping(teacherId, sourceClassId, db = null) {
      const { rows } = await query(db, `
        WITH teacher_students AS (
          SELECT DISTINCT s.id,s.full_name,s.status
            FROM students s
            JOIN class_students cs
              ON cs.student_id=s.id
             AND cs.status='ACTIVE'
            JOIN classes c
              ON c.id=cs.class_id
             AND c.deleted_at IS NULL
           WHERE c.teacher_id=$1
             AND s.status='ACTIVE'
             AND s.deleted_at IS NULL
        )
        SELECT ts.id,
               ts.full_name,
               ts.status,
               EXISTS (
                 SELECT 1
                   FROM class_students src_cs
                  WHERE src_cs.class_id=$2
                    AND src_cs.student_id=ts.id
                    AND src_cs.status='ACTIVE'
               ) AS in_source_class,
               COALESCE(
                 STRING_AGG(
                   DISTINCT c.name || CASE
                     WHEN NULLIF(BTRIM(c.school_year), '') IS NOT NULL THEN ' · ' || c.school_year
                     ELSE ''
                   END,
                   ', ' ORDER BY c.name || CASE
                     WHEN NULLIF(BTRIM(c.school_year), '') IS NOT NULL THEN ' · ' || c.school_year
                     ELSE ''
                   END
                 ),
                 ''
               ) AS class_names
          FROM teacher_students ts
          LEFT JOIN class_students cs
            ON cs.student_id=ts.id
           AND cs.status='ACTIVE'
          LEFT JOIN classes c
            ON c.id=cs.class_id
           AND c.deleted_at IS NULL
           AND c.teacher_id=$1
         GROUP BY ts.id,ts.full_name,ts.status
         ORDER BY
           EXISTS (
             SELECT 1
               FROM class_students src_cs
              WHERE src_cs.class_id=$2
                AND src_cs.student_id=ts.id
                AND src_cs.status='ACTIVE'
           ) DESC,
           ts.full_name,ts.id
      `, [teacherId, sourceClassId]);
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
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const { rows: allowedRows } = await client.query(`
          SELECT src.class_id
            FROM external_data_sources src
            JOIN students s
              ON s.id=$3
             AND s.status='ACTIVE'
             AND s.deleted_at IS NULL
           WHERE src.id=$1
             AND src.teacher_id=$2
             AND EXISTS (
               SELECT 1
                 FROM class_students own_cs
                 JOIN classes own_c
                   ON own_c.id=own_cs.class_id
                  AND own_c.deleted_at IS NULL
                WHERE own_cs.student_id=s.id
                  AND own_cs.status='ACTIVE'
                  AND own_c.teacher_id=$2
             )
           LIMIT 1
        `, [sourceId, teacherId, studentId]);

        const allowed = allowedRows[0];
        if (!allowed) {
          throw new Error('Học sinh không thuộc phạm vi quản lý của giáo viên hiện tại.');
        }

        // Mapping một học sinh vào Sheet của lớp đồng nghĩa học sinh phải là thành viên
        // của đúng class_id mà nguồn dữ liệu đang đại diện. Nếu học sinh hiện thuộc một
        // lớp khác của cùng giáo viên (ví dụ có hai lớp trùng tên), kích hoạt membership
        // của lớp nguồn thay vì ẩn học sinh khỏi danh sách mapping.
        await client.query(`
          INSERT INTO class_students(class_id,student_id,status,joined_at,left_at)
          VALUES($1,$2,'ACTIVE',CURRENT_DATE,NULL)
          ON CONFLICT(class_id,student_id)
          DO UPDATE SET status='ACTIVE',left_at=NULL
        `, [allowed.class_id, studentId]);

        const { rows } = await client.query(`
          UPDATE external_student_links
             SET student_id=$3,match_status='MATCHED',match_method='MANUAL',confidence=100,updated_at=NOW()
           WHERE source_id=$1 AND external_student_key=$2
           RETURNING *
        `, [sourceId, externalKey, studentId]);

        if (!rows[0]) throw new Error('Không tìm thấy học sinh trong dữ liệu Sheet để liên kết.');

        // Gắn luôn các observation đã staging trước đó và buộc lần sync kế tiếp chạy lại
        // dù nội dung Google Sheet chưa đổi. Nếu không reset hash, scheduler sẽ trả
        // NO_CHANGE và dữ liệu lịch sử của học sinh vừa mapping sẽ chưa được materialize.
        await client.query(`
          UPDATE external_observations
             SET student_id=$3,updated_at=NOW()
           WHERE source_id=$1 AND external_student_key=$2
        `, [sourceId, externalKey, studentId]);
        await client.query(`
          UPDATE external_assessment_results ar
             SET student_id=$3,updated_at=NOW()
            FROM external_assessments a
           WHERE ar.assessment_id=a.id
             AND a.source_id=$1
             AND ar.external_student_key=$2
        `, [sourceId, externalKey, studentId]);
        await client.query(`
          UPDATE external_data_sources
             SET last_content_hash=NULL,updated_at=NOW()
           WHERE id=$1 AND teacher_id=$2
        `, [sourceId, teacherId]);

        await client.query('COMMIT');
        return rows[0];
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch {}
        throw error;
      } finally {
        client.release();
      }
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

    async upsertAssessment(data, db = null) {
      const { rows } = await query(db, `
        INSERT INTO external_assessments(
          source_id,class_id,external_assessment_key,observed_on,title,assessment_type,
          skill_code,raw_max_score,normalized_max_score,source_column_start,source_column_end,
          metadata,first_seen_at,last_seen_at
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,NOW(),NOW())
        ON CONFLICT(source_id,external_assessment_key)
        DO UPDATE SET
          class_id=EXCLUDED.class_id,
          observed_on=EXCLUDED.observed_on,
          title=EXCLUDED.title,
          assessment_type=EXCLUDED.assessment_type,
          skill_code=CASE WHEN external_assessments.metadata->>'skill_source'='MANUAL' THEN external_assessments.skill_code ELSE COALESCE(EXCLUDED.skill_code,external_assessments.skill_code) END,
          raw_max_score=COALESCE(EXCLUDED.raw_max_score,external_assessments.raw_max_score),
          normalized_max_score=EXCLUDED.normalized_max_score,
          source_column_start=EXCLUDED.source_column_start,
          source_column_end=EXCLUDED.source_column_end,
          metadata=external_assessments.metadata || EXCLUDED.metadata,
          last_seen_at=NOW(),updated_at=NOW()
        RETURNING *
      `, [
        data.sourceId,
        data.classId,
        data.externalAssessmentKey,
        data.observedOn || null,
        String(data.title || 'Google Sheets').slice(0, 500),
        data.assessmentType || 'TEST',
        data.skillCode || null,
        data.rawMaxScore ?? null,
        data.normalizedMaxScore || 10,
        data.sourceColumnStart,
        data.sourceColumnEnd,
        JSON.stringify(data.metadata || {}),
      ]);
      return rows[0];
    },

    async upsertAssessmentResult(data, db = null) {
      const { rows } = await query(db, `
        INSERT INTO external_assessment_results(
          assessment_id,sync_run_id,external_student_key,student_id,primary_observation_id,
          raw_score,raw_max_score,normalized_score,normalized_max_score,confidence,
          detection_mode,warning,raw_values,active,first_seen_at,last_seen_at
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,TRUE,NOW(),NOW())
        ON CONFLICT(assessment_id,external_student_key)
        DO UPDATE SET
          sync_run_id=EXCLUDED.sync_run_id,
          student_id=COALESCE(EXCLUDED.student_id,external_assessment_results.student_id),
          primary_observation_id=COALESCE(EXCLUDED.primary_observation_id,external_assessment_results.primary_observation_id),
          raw_score=EXCLUDED.raw_score,
          raw_max_score=EXCLUDED.raw_max_score,
          normalized_score=EXCLUDED.normalized_score,
          normalized_max_score=EXCLUDED.normalized_max_score,
          confidence=EXCLUDED.confidence,
          detection_mode=EXCLUDED.detection_mode,
          warning=EXCLUDED.warning,
          raw_values=EXCLUDED.raw_values,
          active=TRUE,last_seen_at=NOW(),updated_at=NOW()
        RETURNING *
      `, [
        data.assessmentId,
        data.syncRunId,
        data.externalStudentKey,
        data.studentId || null,
        data.primaryObservationId || null,
        data.rawScore ?? null,
        data.rawMaxScore ?? null,
        data.normalizedScore ?? null,
        data.normalizedMaxScore || 10,
        data.confidence ?? null,
        data.detectionMode || null,
        data.warning || null,
        JSON.stringify(data.rawValues || []),
      ]);
      return rows[0];
    },

    async materializeAssessmentResult({ result, assessment, source }, db) {
      if (!result.student_id) return null;

      const hasRaw = result.raw_score != null && result.raw_max_score != null && Number(result.raw_max_score) > 0;
      const score = hasRaw ? result.raw_score : result.normalized_score;
      const maxScore = hasRaw ? result.raw_max_score : result.normalized_max_score;
      if (score == null || maxScore == null || Number(maxScore) <= 0) return null;

      // Reuse the observation reference whenever possible. This upgrades v0.20.x
      // derived scores in place instead of creating a duplicate row for the same Sheet cell.
      const ref = result.primary_observation_id
        ? `external-observation:${result.primary_observation_id}`
        : `external-assessment-result:${result.id}`;
      const category = assessment.skill_code || assessment.assessment_type || 'GOOGLE_SHEETS';
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
        result.student_id,
        source.class_id,
        String(assessment.title || 'Google Sheets').slice(0, 250),
        category,
        score,
        maxScore,
        assessment.observed_on,
        ref,
        JSON.stringify({
          sourceId: source.id,
          assessmentId: assessment.id,
          assessmentResultId: result.id,
          mappingType: assessment.mapping_type,
          rawScore: result.raw_score,
          rawMaxScore: result.raw_max_score,
          normalizedScore: result.normalized_score,
          normalizedMaxScore: result.normalized_max_score,
          detectionMode: result.detection_mode,
          confidence: result.confidence,
        }),
      ]);

      if (source.materializeSkillEvents !== false && assessment.skill_code) {
        await query(db, `
          INSERT INTO student_skill_events(
            student_id,class_id,skill_code,source_type,source_id,score,max_score,weight,recorded_at
          ) VALUES($1,$2,$3,'EXTERNAL',$4,$5,$6,1,$7::date::timestamptz)
          ON CONFLICT(student_id,skill_code,source_type,source_id)
          DO UPDATE SET
            class_id=EXCLUDED.class_id,score=EXCLUDED.score,max_score=EXCLUDED.max_score,
            recorded_at=EXCLUDED.recorded_at
        `, [
          result.student_id,
          source.class_id,
          assessment.skill_code,
          result.primary_observation_id || result.id,
          score,
          maxScore,
          assessment.observed_on,
        ]);
      }
      return rows[0]?.id || null;
    },

    async listAssessmentsForSource(sourceId, teacherId) {
      const { rows } = await pool.query(`
        SELECT a.*,
               e.title AS exam_title,
               ass.title AS assignment_title,
               COUNT(ar.id)::int AS result_count,
               COUNT(ar.id) FILTER (WHERE ar.student_id IS NOT NULL)::int AS matched_result_count,
               COUNT(ar.id) FILTER (WHERE ar.warning IS NOT NULL)::int AS warning_count
          FROM external_assessments a
          JOIN external_data_sources s ON s.id=a.source_id
          LEFT JOIN exams e ON e.id=a.exam_id
          LEFT JOIN assignments ass ON ass.id=a.assignment_id
          LEFT JOIN external_assessment_results ar ON ar.assessment_id=a.id AND ar.active=TRUE
         WHERE a.source_id=$1 AND s.teacher_id=$2 AND a.status='ACTIVE'
         GROUP BY a.id,e.title,ass.title
         ORDER BY a.observed_on DESC NULLS LAST,a.source_column_start,a.id
      `, [sourceId, teacherId]);
      return rows;
    },

    async getAssessmentDetail(sourceId, assessmentId, teacherId) {
      const { rows } = await pool.query(`
        SELECT a.*,s.name AS source_name,c.name AS class_name,c.school_year,
               e.title AS exam_title,ass.title AS assignment_title
          FROM external_assessments a
          JOIN external_data_sources s ON s.id=a.source_id
          JOIN classes c ON c.id=a.class_id
          LEFT JOIN exams e ON e.id=a.exam_id
          LEFT JOIN assignments ass ON ass.id=a.assignment_id
         WHERE a.id=$1 AND a.source_id=$2 AND s.teacher_id=$3
         LIMIT 1
      `, [assessmentId, sourceId, teacherId]);
      return rows[0] || null;
    },

    async listAssessmentResults(sourceId, assessmentId, teacherId) {
      const { rows } = await pool.query(`
        SELECT ar.*,l.external_student_name,s.full_name AS student_name,
               ss.id AS materialized_score_id,
               ss.score::float AS materialized_score,
               ss.max_score::float AS materialized_max_score
          FROM external_assessment_results ar
          JOIN external_assessments a ON a.id=ar.assessment_id
          JOIN external_data_sources src ON src.id=a.source_id
          LEFT JOIN external_student_links l
            ON l.source_id=a.source_id AND l.external_student_key=ar.external_student_key
          LEFT JOIN students s ON s.id=ar.student_id
          LEFT JOIN student_scores ss
            ON ss.student_id=ar.student_id
           AND ss.source_type='GOOGLE_SHEETS'
           AND ss.source_ref=CASE
             WHEN ar.primary_observation_id IS NOT NULL THEN 'external-observation:' || ar.primary_observation_id::text
             ELSE 'external-assessment-result:' || ar.id::text
           END
         WHERE ar.assessment_id=$1 AND a.source_id=$2 AND src.teacher_id=$3 AND ar.active=TRUE
         ORDER BY COALESCE(s.full_name,l.external_student_name,ar.external_student_key),ar.id
      `, [assessmentId, sourceId, teacherId]);
      return rows;
    },

    async listAssessmentTargets(teacherId, classId) {
      const [exams, assignments] = await Promise.all([
        pool.query(`
          SELECT e.id,e.title,e.status,e.start_at,e.end_at
            FROM exams e
            JOIN classes c ON c.id=e.class_id
           WHERE e.class_id=$1 AND c.teacher_id=$2 AND c.deleted_at IS NULL
           ORDER BY e.created_at DESC,e.id DESC
        `, [classId, teacherId]),
        pool.query(`
          SELECT a.id,a.title,a.status,a.type,a.due_at
            FROM assignments a
            JOIN classes c ON c.id=a.class_id
           WHERE a.class_id=$1 AND c.teacher_id=$2 AND c.deleted_at IS NULL
           ORDER BY a.created_at DESC,a.id DESC
        `, [classId, teacherId]),
      ]);
      return { exams: exams.rows, assignments: assignments.rows };
    },


    async listSkills() {
      const { rows } = await pool.query(`SELECT code,label,sort_order AS "sortOrder" FROM skills WHERE is_active=TRUE ORDER BY sort_order,code`);
      return rows;
    },

    async manualSetAssessmentSkill({ sourceId, assessmentId, teacherId, skillCode = null }) {
      const raw=String(skillCode ?? '').trim().toUpperCase();
      const autoMode=raw==='__AUTO__';
      const normalized=autoMode?null:(raw==='__NONE__'||raw===''?null:raw);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows: ownedRows } = await client.query(`
          SELECT a.id,a.class_id,a.skill_code,a.assessment_type,a.metadata
            FROM external_assessments a
            JOIN external_data_sources s ON s.id=a.source_id
           WHERE a.id=$1 AND a.source_id=$2 AND s.teacher_id=$3
           LIMIT 1
        `,[assessmentId,sourceId,teacherId]);
        const owned=ownedRows[0];
        if(!owned) throw new Error('Không tìm thấy bài kiểm tra nguồn hoặc bạn không có quyền cập nhật.');
        if(normalized){
          const {rows:skillRows}=await client.query(`SELECT code FROM skills WHERE code=$1 AND is_active=TRUE LIMIT 1`,[normalized]);
          if(!skillRows[0]) throw new Error('Kỹ năng không hợp lệ.');
        }

        // Remove the previously-derived external skill event before changing the mapping.
        // The forced next sync will recreate it with the new/auto-detected skill when applicable.
        if(owned.skill_code){
          await client.query(`
            DELETE FROM student_skill_events e
             USING external_assessment_results ar
             WHERE ar.assessment_id=$1
               AND ar.student_id IS NOT NULL
               AND e.student_id=ar.student_id
               AND e.class_id=$2
               AND e.source_type='EXTERNAL'
               AND e.skill_code=$3
               AND e.source_id=COALESCE(ar.primary_observation_id,ar.id)
          `,[assessmentId,owned.class_id,owned.skill_code]);
        }

        let rows;
        if(autoMode){
          ({rows}=await client.query(`
            UPDATE external_assessments
               SET skill_code=NULL,
                   metadata=(metadata - 'skill_source' - 'manual_skill_code'),
                   updated_at=NOW()
             WHERE id=$1 AND source_id=$2
             RETURNING *
          `,[assessmentId,sourceId]));
        }else{
          ({rows}=await client.query(`
            UPDATE external_assessments
               SET skill_code=$3,
                   metadata=metadata || jsonb_build_object('skill_source','MANUAL','manual_skill_code',$3),
                   updated_at=NOW()
             WHERE id=$1 AND source_id=$2
             RETURNING *
          `,[assessmentId,sourceId,normalized]));
        }

        await client.query(`
          UPDATE student_scores ss
             SET category=COALESCE($2,$3)
            FROM external_assessment_results ar
           WHERE ar.assessment_id=$1
             AND ar.student_id=ss.student_id
             AND ss.source_type='GOOGLE_SHEETS'
             AND ss.source_ref=CASE WHEN ar.primary_observation_id IS NOT NULL THEN 'external-observation:'||ar.primary_observation_id::text ELSE 'external-assessment-result:'||ar.id::text END
        `,[assessmentId,autoMode?null:normalized,owned.assessment_type||'GOOGLE_SHEETS']);
        await client.query(`UPDATE external_data_sources SET last_content_hash=NULL,updated_at=NOW() WHERE id=$1 AND teacher_id=$2`,[sourceId,teacherId]);
        await client.query('COMMIT');
        return rows[0];
      } catch(error){
        try{await client.query('ROLLBACK');}catch{}
        throw error;
      } finally { client.release(); }
    },

    async manualLinkAssessment({ sourceId, assessmentId, teacherId, mappingType, targetId = null }) {
      const type = String(mappingType || '').toUpperCase();
      if (!['EXTERNAL','EXAM','ASSIGNMENT'].includes(type)) {
        throw new Error('Loại liên kết bài kiểm tra không hợp lệ.');
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows: ownedRows } = await client.query(`
          SELECT a.id,a.class_id
            FROM external_assessments a
            JOIN external_data_sources s ON s.id=a.source_id
           WHERE a.id=$1 AND a.source_id=$2 AND s.teacher_id=$3
           LIMIT 1
        `, [assessmentId, sourceId, teacherId]);
        const owned = ownedRows[0];
        if (!owned) throw new Error('Không tìm thấy bài kiểm tra nguồn hoặc bạn không có quyền cập nhật.');

        let examId = null;
        let assignmentId = null;
        if (type === 'EXAM') {
          if (!Number.isInteger(targetId) || targetId <= 0) throw new Error('Vui lòng chọn bài kiểm tra trong ứng dụng.');
          const { rows } = await client.query(`
            SELECT e.id FROM exams e
            JOIN classes c ON c.id=e.class_id
            WHERE e.id=$1 AND e.class_id=$2 AND c.teacher_id=$3 AND c.deleted_at IS NULL
            LIMIT 1
          `, [targetId, owned.class_id, teacherId]);
          if (!rows[0]) throw new Error('Exam không thuộc lớp nguồn hiện tại.');
          examId = targetId;
        } else if (type === 'ASSIGNMENT') {
          if (!Number.isInteger(targetId) || targetId <= 0) throw new Error('Vui lòng chọn bài tập trong ứng dụng.');
          const { rows } = await client.query(`
            SELECT a.id FROM assignments a
            JOIN classes c ON c.id=a.class_id
            WHERE a.id=$1 AND a.class_id=$2 AND c.teacher_id=$3 AND c.deleted_at IS NULL
            LIMIT 1
          `, [targetId, owned.class_id, teacherId]);
          if (!rows[0]) throw new Error('Assignment không thuộc lớp nguồn hiện tại.');
          assignmentId = targetId;
        }

        const { rows } = await client.query(`
          UPDATE external_assessments
             SET mapping_type=$3,exam_id=$4,assignment_id=$5,updated_at=NOW()
           WHERE id=$1 AND source_id=$2
           RETURNING *
        `, [assessmentId, sourceId, type, examId, assignmentId]);

        await client.query(`
          UPDATE external_data_sources
             SET last_content_hash=NULL,updated_at=NOW()
           WHERE id=$1 AND teacher_id=$2
        `, [sourceId, teacherId]);
        await client.query('COMMIT');
        return rows[0];
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch {}
        throw error;
      } finally {
        client.release();
      }
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

    async refreshStudentProgress(studentIds, db = null) {
      const ids = [...new Set((studentIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
      if (!ids.length) return 0;

      const { rows } = await query(db, `
        WITH target AS (
          SELECT UNNEST($1::bigint[]) AS student_id
        ), score_summary AS (
          SELECT t.student_id,
                 COALESCE(
                   ROUND(AVG((ss.score / NULLIF(ss.max_score,0)) * 10)::numeric, 2),
                   0
                 ) AS average_score
            FROM target t
            LEFT JOIN student_scores ss ON ss.student_id=t.student_id
           GROUP BY t.student_id
        ), session_rows AS (
          SELECT a.student_id, cs.session_date AS attendance_date, a.status
            FROM session_attendance a
            JOIN class_sessions cs ON cs.id=a.session_id
           WHERE a.student_id=ANY($1::bigint[])
        ), combined_attendance AS (
          SELECT student_id,attendance_date,status FROM session_rows
          UNION ALL
          SELECT ar.student_id,ar.attendance_date,ar.status
            FROM attendance_records ar
           WHERE ar.student_id=ANY($1::bigint[])
             AND NOT EXISTS (
               SELECT 1
                 FROM session_rows sr
                WHERE sr.student_id=ar.student_id
                  AND sr.attendance_date=ar.attendance_date
             )
        ), attendance_summary AS (
          SELECT t.student_id,
                 CASE
                   WHEN COUNT(c.student_id)=0 THEN 0
                   ELSE ROUND(
                     100.0 * COUNT(c.student_id) FILTER (WHERE c.status IN ('PRESENT','LATE','ONLINE'))
                     / COUNT(c.student_id),
                     2
                   )
                 END AS attendance_rate
            FROM target t
            LEFT JOIN combined_attendance c ON c.student_id=t.student_id
           GROUP BY t.student_id
        )
        INSERT INTO student_progress_summary(student_id,average_score,attendance_rate,updated_at)
        SELECT t.student_id,ss.average_score,att.attendance_rate,NOW()
          FROM target t
          JOIN score_summary ss ON ss.student_id=t.student_id
          JOIN attendance_summary att ON att.student_id=t.student_id
        ON CONFLICT(student_id)
        DO UPDATE SET
          average_score=EXCLUDED.average_score,
          attendance_rate=EXCLUDED.attendance_rate,
          updated_at=NOW()
        RETURNING student_id
      `, [ids]);
      return rows.length;
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
