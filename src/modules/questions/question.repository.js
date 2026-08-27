const env = require('../../config/env');
const pool = require('../../config/db');
const demoStore = require('../../shared/demo-store');

function idOf(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function findGrades() {
  if (env.demo.enabled) return [6, 7, 8, 9].map((grade) => ({ id: grade, gradeNo: grade, name: `Khối ${grade}` }));
  const { rows } = await pool.query(`SELECT id, grade_no AS "gradeNo", name FROM grades WHERE grade_no BETWEEN 6 AND 9 ORDER BY grade_no`);
  return rows;
}

async function findLessons() {
  if (env.demo.enabled) return demoStore.lessons.map((l) => ({ id: l.id, title: l.title, unitName: l.unitName, classId: l.classId }));
  const { rows } = await pool.query(`SELECT id, class_id AS "classId", unit_name AS "unitName", title FROM lessons ORDER BY class_id, sort_order, id`);
  return rows;
}

function demoDecorate(question) {
  return {
    ...question,
    options: (demoStore.questionOptions || []).filter((o) => o.questionId === question.id).sort((a,b) => a.sortOrder - b.sortOrder),
  };
}

async function findAll(filters = {}) {
  const gradeNo = Number(filters.grade || 0);
  const type = String(filters.type || '').trim();
  const difficulty = String(filters.difficulty || '').trim();
  const status = String(filters.status || '').trim();
  if (env.demo.enabled) {
    return (demoStore.questions || [])
      .filter((q) => (!gradeNo || q.grade === gradeNo) && (!type || q.questionType === type) && (!difficulty || q.difficulty === difficulty) && (!status || q.status === status))
      .map(demoDecorate)
      .sort((a,b) => b.id - a.id);
  }
  const params = [];
  const where = [];
  if (gradeNo) { params.push(gradeNo); where.push(`g.grade_no = $${params.length}`); }
  if (type) { params.push(type); where.push(`q.question_type = $${params.length}`); }
  if (difficulty) { params.push(difficulty); where.push(`q.difficulty = $${params.length}`); }
  if (status) { params.push(status); where.push(`q.status = $${params.length}`); }
  const { rows } = await pool.query(`
    SELECT q.id, q.grade_id AS "gradeId", g.grade_no AS grade, q.lesson_id AS "lessonId",
           l.title AS "lessonTitle", q.question_type AS "questionType", q.stem,
           q.correct_answer AS "correctAnswer", q.explanation, q.difficulty,
           q.default_points::float AS "defaultPoints", q.status, q.created_at AS "createdAt",
           COUNT(o.id)::int AS "optionCount"
      FROM questions q
      LEFT JOIN grades g ON g.id = q.grade_id
      LEFT JOIN lessons l ON l.id = q.lesson_id
      LEFT JOIN question_options o ON o.question_id = q.id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY q.id, g.id, l.id
     ORDER BY q.id DESC
  `, params);
  return rows;
}

async function findPublishedForExam(gradeIdValue = null) {
  const gradeId = idOf(gradeIdValue);
  if (env.demo.enabled) {
    return (demoStore.questions || []).filter((q) => q.status === 'PUBLISHED' && (!gradeId || q.grade === gradeId)).map(demoDecorate);
  }
  const params = [];
  const where = [`q.status='PUBLISHED'`];
  if (gradeId) { params.push(gradeId); where.push(`q.grade_id=$${params.length}`); }
  const { rows } = await pool.query(`
    SELECT q.id, q.grade_id AS "gradeId", g.grade_no AS grade, q.lesson_id AS "lessonId", l.title AS "lessonTitle",
           q.question_type AS "questionType", q.stem, q.difficulty, q.default_points::float AS "defaultPoints"
      FROM questions q
      LEFT JOIN grades g ON g.id=q.grade_id
      LEFT JOIN lessons l ON l.id=q.lesson_id
     WHERE ${where.join(' AND ')}
     ORDER BY g.grade_no NULLS LAST, q.id DESC
  `, params);
  return rows;
}

async function findById(value) {
  const id = idOf(value);
  if (!id) return null;
  if (env.demo.enabled) {
    const question = (demoStore.questions || []).find((q) => q.id === id);
    return question ? demoDecorate(question) : null;
  }
  const { rows } = await pool.query(`
    SELECT q.id, q.grade_id AS "gradeId", g.grade_no AS grade, q.lesson_id AS "lessonId", l.title AS "lessonTitle",
           q.question_type AS "questionType", q.stem, q.correct_answer AS "correctAnswer",
           q.explanation, q.difficulty, q.default_points::float AS "defaultPoints", q.status,
           q.created_at AS "createdAt", q.updated_at AS "updatedAt"
      FROM questions q
      LEFT JOIN grades g ON g.id=q.grade_id
      LEFT JOIN lessons l ON l.id=q.lesson_id
     WHERE q.id=$1 LIMIT 1
  `, [id]);
  if (!rows[0]) return null;
  const options = await pool.query(`SELECT id, option_key AS "optionKey", option_text AS "optionText", is_correct AS "isCorrect", sort_order AS "sortOrder" FROM question_options WHERE question_id=$1 ORDER BY sort_order,id`, [id]);
  return { ...rows[0], options: options.rows };
}

async function saveOptions(client, questionId, data) {
  await client.query(`DELETE FROM question_options WHERE question_id=$1`, [questionId]);
  const rows = [];
  if (data.questionType === 'TRUE_FALSE') {
    rows.push(['A', 'True', data.correctOption === 'A', 1], ['B', 'False', data.correctOption === 'B', 2]);
  } else if (data.questionType === 'MULTIPLE_CHOICE') {
    ['A','B','C','D'].forEach((key, index) => {
      const text = String(data.options?.[key] || '').trim();
      if (text) rows.push([key, text, data.correctOption === key, index + 1]);
    });
  }
  for (const [key, text, correct, order] of rows) {
    await client.query(`INSERT INTO question_options(question_id,option_key,option_text,is_correct,sort_order) VALUES($1,$2,$3,$4,$5)`, [questionId,key,text,correct,order]);
  }
}

async function create(data, userId) {
  if (env.demo.enabled) {
    const id = Math.max(0, ...(demoStore.questions || []).map((q) => q.id)) + 1;
    const grade = data.gradeId ? Number(data.gradeId) : null;
    const question = { id, gradeId: data.gradeId || null, grade, lessonId: data.lessonId || null, questionType: data.questionType, stem: data.stem, correctAnswer: data.correctAnswer || '', explanation: data.explanation || '', difficulty: data.difficulty, defaultPoints: data.defaultPoints, status: 'DRAFT' };
    demoStore.questions = demoStore.questions || []; demoStore.questionOptions = demoStore.questionOptions || [];
    demoStore.questions.push(question);
    const opts = data.questionType === 'TRUE_FALSE' ? { A:'True', B:'False' } : data.options;
    Object.entries(opts || {}).forEach(([key,text], index) => { if (String(text||'').trim()) demoStore.questionOptions.push({ id: demoStore.questionOptions.length + 1, questionId:id, optionKey:key, optionText:String(text).trim(), isCorrect:data.correctOption===key, sortOrder:index+1 }); });
    return question;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      INSERT INTO questions(grade_id,lesson_id,created_by,question_type,stem,correct_answer,explanation,difficulty,default_points,status)
      VALUES($1,$2,$3,$4,$5,NULLIF($6,''),NULLIF($7,''),$8,$9,'DRAFT') RETURNING id
    `, [data.gradeId || null, data.lessonId || null, userId, data.questionType, data.stem, data.correctAnswer || '', data.explanation || '', data.difficulty, data.defaultPoints]);
    await saveOptions(client, rows[0].id, data);
    await client.query('COMMIT');
    return findById(rows[0].id);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

async function update(value, data) {
  const id = idOf(value); if (!id) throw new Error('QUESTION_NOT_FOUND');
  if (env.demo.enabled) {
    const q=(demoStore.questions||[]).find((x)=>x.id===id); if(!q) throw new Error('QUESTION_NOT_FOUND');
    Object.assign(q,{gradeId:data.gradeId||null,grade:data.gradeId?Number(data.gradeId):null,lessonId:data.lessonId||null,questionType:data.questionType,stem:data.stem,correctAnswer:data.correctAnswer||'',explanation:data.explanation||'',difficulty:data.difficulty,defaultPoints:data.defaultPoints});
    demoStore.questionOptions=(demoStore.questionOptions||[]).filter((o)=>o.questionId!==id);
    const opts=data.questionType==='TRUE_FALSE'?{A:'True',B:'False'}:data.options;
    Object.entries(opts||{}).forEach(([key,text],index)=>{if(String(text||'').trim())demoStore.questionOptions.push({id:demoStore.questionOptions.length+1,questionId:id,optionKey:key,optionText:String(text).trim(),isCorrect:data.correctOption===key,sortOrder:index+1});});
    return demoDecorate(q);
  }
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const result=await client.query(`UPDATE questions SET grade_id=$2,lesson_id=$3,question_type=$4,stem=$5,correct_answer=NULLIF($6,''),explanation=NULLIF($7,''),difficulty=$8,default_points=$9,updated_at=NOW() WHERE id=$1 RETURNING id`,[id,data.gradeId||null,data.lessonId||null,data.questionType,data.stem,data.correctAnswer||'',data.explanation||'',data.difficulty,data.defaultPoints]);
    if(!result.rows[0]) throw new Error('QUESTION_NOT_FOUND');
    await saveOptions(client,id,data); await client.query('COMMIT'); return findById(id);
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}

async function publish(value) {
  const id=idOf(value); if(!id) throw new Error('QUESTION_NOT_FOUND');
  if(env.demo.enabled){const q=(demoStore.questions||[]).find((x)=>x.id===id);if(!q)throw new Error('QUESTION_NOT_FOUND');q.status='PUBLISHED';return q;}
  const {rows}=await pool.query(`UPDATE questions SET status='PUBLISHED',updated_at=NOW() WHERE id=$1 RETURNING id,status`,[id]); if(!rows[0]) throw new Error('QUESTION_NOT_FOUND'); return rows[0];
}

module.exports={findGrades,findLessons,findAll,findPublishedForExam,findById,create,update,publish};
