const env = require('../../config/env');
const pool = require('../../config/db');
const demoStore = require('../../shared/demo-store');

function normalizeId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function findClasses() {
  if (env.demo.enabled) {
    return demoStore.classes.map((item) => ({ id: item.id, name: item.name, grade: item.grade }));
  }
  const { rows } = await pool.query(`
    SELECT c.id, c.name, g.grade_no AS grade
      FROM classes c
      JOIN grades g ON g.id = c.grade_id
     WHERE c.status = 'ACTIVE'
     ORDER BY g.grade_no, c.name
  `);
  return rows;
}

async function findAll(filters = {}) {
  const classId = normalizeId(filters.classId);
  const status = filters.status || '';

  if (env.demo.enabled) {
    return demoStore.lessons
      .filter((lesson) => (!classId || lesson.classId === classId) && (!status || lesson.status === status))
      .map((lesson) => {
        const classItem = demoStore.classes.find((item) => item.id === lesson.classId);
        return {
          ...lesson,
          className: classItem?.name || '',
          grade: classItem?.grade || null,
          materialCount: demoStore.materials.filter((item) => item.lessonId === lesson.id).length,
          assignmentCount: demoStore.assignments.filter((item) => item.lessonId === lesson.id).length,
        };
      })
      .sort((a, b) => a.classId - b.classId || a.sortOrder - b.sortOrder || a.id - b.id);
  }

  const params = [];
  const where = [];
  if (classId) {
    params.push(classId);
    where.push(`l.class_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`l.status = $${params.length}`);
  }

  const { rows } = await pool.query(`
    SELECT l.id,
           l.class_id AS "classId",
           l.title,
           l.unit_name AS "unitName",
           l.summary,
           l.status,
           l.sort_order AS "sortOrder",
           l.published_at AS "publishedAt",
           l.created_at AS "createdAt",
           c.name AS "className",
           g.grade_no AS grade,
           COUNT(DISTINCT m.id)::int AS "materialCount",
           COUNT(DISTINCT a.id)::int AS "assignmentCount"
      FROM lessons l
      JOIN classes c ON c.id = l.class_id
      JOIN grades g ON g.id = c.grade_id
      LEFT JOIN materials m ON m.lesson_id = l.id
      LEFT JOIN assignments a ON a.lesson_id = l.id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY l.id, c.id, g.id
     ORDER BY g.grade_no, c.name, l.sort_order, l.id
  `, params);
  return rows;
}

async function findById(value) {
  const id = normalizeId(value);
  if (!id) return null;

  if (env.demo.enabled) {
    const lesson = demoStore.lessons.find((item) => item.id === id);
    if (!lesson) return null;
    const classItem = demoStore.classes.find((item) => item.id === lesson.classId);
    return {
      ...lesson,
      className: classItem?.name || '',
      grade: classItem?.grade || null,
      materials: demoStore.materials.filter((item) => item.lessonId === id),
      assignments: demoStore.assignments.filter((item) => item.lessonId === id),
    };
  }

  const lessonResult = await pool.query(`
    SELECT l.id,
           l.class_id AS "classId",
           l.title,
           l.unit_name AS "unitName",
           l.summary,
           l.content,
           l.status,
           l.sort_order AS "sortOrder",
           l.published_at AS "publishedAt",
           l.created_at AS "createdAt",
           l.updated_at AS "updatedAt",
           c.name AS "className",
           g.grade_no AS grade
      FROM lessons l
      JOIN classes c ON c.id = l.class_id
      JOIN grades g ON g.id = c.grade_id
     WHERE l.id = $1
     LIMIT 1
  `, [id]);
  if (!lessonResult.rows[0]) return null;

  const [materialResult, assignmentResult] = await Promise.all([
    pool.query(`
      SELECT id, title, type, description,
             resource_url AS "resourceUrl",
             status,
             published_at AS "publishedAt"
        FROM materials
       WHERE lesson_id = $1
       ORDER BY published_at DESC, id DESC
    `, [id]),
    pool.query(`
      SELECT id, title, type, status,
             due_at AS "dueAt",
             max_score::float AS "maxScore"
        FROM assignments
       WHERE lesson_id = $1
       ORDER BY due_at NULLS LAST, id DESC
    `, [id]),
  ]);

  return { ...lessonResult.rows[0], materials: materialResult.rows, assignments: assignmentResult.rows };
}

async function create(data, userId) {
  if (env.demo.enabled) {
    const classItem = demoStore.classes.find((item) => item.id === Number(data.classId));
    if (!classItem) throw new Error('CLASS_NOT_FOUND');
    const id = Math.max(0, ...demoStore.lessons.map((item) => item.id)) + 1;
    const lesson = {
      id,
      classId: Number(data.classId),
      title: data.title,
      unitName: data.unitName || '',
      summary: data.summary || '',
      content: data.content || '',
      status: 'DRAFT',
      sortOrder: Number(data.sortOrder || 0),
      publishedAt: null,
      createdBy: Number(userId),
    };
    demoStore.lessons.push(lesson);
    return lesson;
  }

  const { rows } = await pool.query(`
    INSERT INTO lessons (class_id, title, unit_name, summary, content, sort_order, created_by, status)
    SELECT c.id, $2, NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''), $6, $7, 'DRAFT'
      FROM classes c
     WHERE c.id = $1 AND c.status = 'ACTIVE'
    RETURNING id, class_id AS "classId", title, unit_name AS "unitName", summary, content,
              status, sort_order AS "sortOrder", created_at AS "createdAt"
  `, [data.classId, data.title, data.unitName || '', data.summary || '', data.content || '', Number(data.sortOrder || 0), userId]);
  if (!rows[0]) throw new Error('CLASS_NOT_FOUND');
  return rows[0];
}


async function update(value, data) {
  const id = normalizeId(value);
  if (!id) throw new Error('LESSON_NOT_FOUND');
  if (env.demo.enabled) {
    const lesson = demoStore.lessons.find((item) => item.id === id);
    const classItem = demoStore.classes.find((item) => item.id === Number(data.classId));
    if (!lesson) throw new Error('LESSON_NOT_FOUND');
    if (!classItem) throw new Error('CLASS_NOT_FOUND');
    Object.assign(lesson, {
      classId: Number(data.classId),
      title: data.title,
      unitName: data.unitName || '',
      summary: data.summary || '',
      content: data.content || '',
      sortOrder: Number(data.sortOrder || 0),
    });
    demoStore.materials.filter((item) => item.lessonId === id).forEach((item) => {
      item.classId = lesson.classId;
      item.unit = lesson.unitName;
    });
    demoStore.assignments.filter((item) => item.lessonId === id).forEach((item) => { item.classId = lesson.classId; });
    return lesson;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const classCheck = await client.query(`SELECT id FROM classes WHERE id=$1 AND status='ACTIVE'`, [data.classId]);
    if (!classCheck.rows[0]) throw new Error('CLASS_NOT_FOUND');
    const { rows } = await client.query(`
      UPDATE lessons
         SET class_id=$2, title=$3, unit_name=NULLIF($4,''), summary=NULLIF($5,''), content=NULLIF($6,''),
             sort_order=$7, updated_at=NOW()
       WHERE id=$1
      RETURNING id, class_id AS "classId", title, unit_name AS "unitName", summary, content,
                status, sort_order AS "sortOrder", published_at AS "publishedAt"
    `, [id, data.classId, data.title, data.unitName || '', data.summary || '', data.content || '', Number(data.sortOrder || 0)]);
    if (!rows[0]) throw new Error('LESSON_NOT_FOUND');
    await client.query(`UPDATE materials SET class_id=$2, unit_name=NULLIF($3,'') WHERE lesson_id=$1`, [id, data.classId, data.unitName || '']);
    await client.query(`UPDATE assignments SET class_id=$2 WHERE lesson_id=$1`, [id, data.classId]);
    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function publish(value) {
  const id = normalizeId(value);
  if (!id) throw new Error('LESSON_NOT_FOUND');
  if (env.demo.enabled) {
    const lesson = demoStore.lessons.find((item) => item.id === id);
    if (!lesson) throw new Error('LESSON_NOT_FOUND');
    lesson.status = 'PUBLISHED';
    lesson.publishedAt = new Date().toISOString();
    return lesson;
  }
  const { rows } = await pool.query(`
    UPDATE lessons
       SET status = 'PUBLISHED', published_at = COALESCE(published_at, NOW()), updated_at = NOW()
     WHERE id = $1
    RETURNING id, status, published_at AS "publishedAt"
  `, [id]);
  if (!rows[0]) throw new Error('LESSON_NOT_FOUND');
  return rows[0];
}

async function addMaterial(lessonIdValue, data, userId) {
  const lessonId = normalizeId(lessonIdValue);
  if (!lessonId) throw new Error('LESSON_NOT_FOUND');

  if (env.demo.enabled) {
    const lesson = demoStore.lessons.find((item) => item.id === lessonId);
    if (!lesson) throw new Error('LESSON_NOT_FOUND');
    const id = Math.max(0, ...demoStore.materials.map((item) => item.id)) + 1;
    const material = {
      id,
      classId: lesson.classId,
      lessonId,
      unit: lesson.unitName,
      title: data.title,
      type: data.type || 'LINK',
      description: data.description || '',
      resourceUrl: data.resourceUrl || '',
      status: data.status || 'PUBLISHED',
      publishedAt: new Date().toISOString().slice(0, 10),
      createdBy: Number(userId),
    };
    demoStore.materials.push(material);
    return material;
  }

  const { rows } = await pool.query(`
    INSERT INTO materials
      (class_id, lesson_id, unit_name, title, type, description, resource_url, status, created_by, published_at)
    SELECT l.class_id, l.id, l.unit_name, $2, $3, NULLIF($4, ''), NULLIF($5, ''), $6, $7, CURRENT_DATE
      FROM lessons l
     WHERE l.id = $1
    RETURNING id, class_id AS "classId", lesson_id AS "lessonId", unit_name AS unit,
              title, type, description, resource_url AS "resourceUrl", status, published_at AS "publishedAt"
  `, [lessonId, data.title, data.type || 'LINK', data.description || '', data.resourceUrl || '', data.status || 'PUBLISHED', userId]);
  if (!rows[0]) throw new Error('LESSON_NOT_FOUND');
  return rows[0];
}

module.exports = { findClasses, findAll, findById, create, update, publish, addMaterial };
