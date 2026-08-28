const env=require('../../config/env');
const pool=require('../../config/db');
const demoStore=require('../../shared/demo-store');
const CATALOG=[
  {code:'VOCABULARY',label:'Vocabulary',sortOrder:10},{code:'GRAMMAR',label:'Grammar',sortOrder:20},
  {code:'READING',label:'Reading',sortOrder:30},{code:'LISTENING',label:'Listening',sortOrder:40},
  {code:'WRITING',label:'Writing',sortOrder:50},{code:'SPEAKING',label:'Speaking',sortOrder:60},
  {code:'PRONUNCIATION',label:'Pronunciation',sortOrder:70},
];
const VALID=new Set(CATALOG.map(x=>x.code));
function normalizeCodes(values){const list=Array.isArray(values)?values:[values];return [...new Set(list.map(v=>String(v||'').trim().toUpperCase()).filter(v=>VALID.has(v)))];}
async function findSkills(){if(env.demo.enabled)return CATALOG;const {rows}=await pool.query('SELECT code,label,sort_order AS "sortOrder" FROM skills WHERE is_active=TRUE ORDER BY sort_order,code');return rows;}
async function setAssignmentSkills(assignmentId,codes){const values=normalizeCodes(codes);if(env.demo.enabled){demoStore.assignmentSkills=demoStore.assignmentSkills||[];demoStore.assignmentSkills=demoStore.assignmentSkills.filter(x=>Number(x.assignmentId)!==Number(assignmentId));values.forEach(code=>demoStore.assignmentSkills.push({assignmentId:Number(assignmentId),skillCode:code,weight:1}));return values;}const c=await pool.connect();try{await c.query('BEGIN');await c.query('DELETE FROM assignment_skills WHERE assignment_id=$1',[assignmentId]);for(const code of values)await c.query('INSERT INTO assignment_skills(assignment_id,skill_code,weight) VALUES($1,$2,1)',[assignmentId,code]);await c.query('COMMIT');return values;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
async function getAssignmentSkills(assignmentId){if(env.demo.enabled)return (demoStore.assignmentSkills||[]).filter(x=>Number(x.assignmentId)===Number(assignmentId)).map(x=>x.skillCode);const {rows}=await pool.query('SELECT skill_code AS "skillCode" FROM assignment_skills WHERE assignment_id=$1 ORDER BY skill_code',[assignmentId]);return rows.map(x=>x.skillCode);}
async function setQuestionSkills(questionId,codes){const values=normalizeCodes(codes);if(env.demo.enabled){demoStore.questionSkills=demoStore.questionSkills||[];demoStore.questionSkills=demoStore.questionSkills.filter(x=>Number(x.questionId)!==Number(questionId));values.forEach(code=>demoStore.questionSkills.push({questionId:Number(questionId),skillCode:code,weight:1}));return values;}const c=await pool.connect();try{await c.query('BEGIN');await c.query('DELETE FROM question_skills WHERE question_id=$1',[questionId]);for(const code of values)await c.query('INSERT INTO question_skills(question_id,skill_code,weight) VALUES($1,$2,1)',[questionId,code]);await c.query('COMMIT');return values;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
async function getQuestionSkills(questionId){if(env.demo.enabled)return (demoStore.questionSkills||[]).filter(x=>Number(x.questionId)===Number(questionId)).map(x=>x.skillCode);const {rows}=await pool.query('SELECT skill_code AS "skillCode" FROM question_skills WHERE question_id=$1 ORDER BY skill_code',[questionId]);return rows.map(x=>x.skillCode);}
async function refreshLegacySummary(studentId){if(env.demo.enabled)return;await pool.query(`INSERT INTO student_skills(student_id,skill,score)
SELECT student_id,INITCAP(LOWER(skill_code)),ROUND((SUM((score/NULLIF(max_score,0))*10*weight)/NULLIF(SUM(weight),0))::numeric,2)
FROM student_skill_events WHERE student_id=$1 GROUP BY student_id,skill_code
ON CONFLICT(student_id,skill) DO UPDATE SET score=EXCLUDED.score`,[studentId]);}
async function recordAssignmentGrade(assignmentId,studentId){if(env.demo.enabled){const a=demoStore.assignments.find(x=>x.id===Number(assignmentId));const sub=(demoStore.assignmentSubmissions||[]).find(x=>x.assignmentId===Number(assignmentId)&&x.studentId===Number(studentId));const tags=(demoStore.assignmentSkills||[]).filter(x=>x.assignmentId===Number(assignmentId));if(!a||!sub||sub.score==null||!tags.length)return;demoStore.studentSkills=demoStore.studentSkills||[];tags.forEach(t=>{let r=demoStore.studentSkills.find(x=>x.studentId===Number(studentId)&&String(x.skill).toUpperCase()===t.skillCode);const value=Number(((Number(sub.score)/Number(a.maxScore||10))*10).toFixed(2));if(r)r.score=value;else demoStore.studentSkills.push({studentId:Number(studentId),skill:t.skillCode.charAt(0)+t.skillCode.slice(1).toLowerCase(),score:value});});return;}
const {rows}=await pool.query(`SELECT a.class_id AS "classId",a.max_score::float AS "maxScore",a.rubric_enabled AS "rubricEnabled",s.score::float AS score,COALESCE(s.rubric_scores,'{}'::jsonb) AS "rubricScores",sk.skill_code AS "skillCode",sk.weight::float AS weight,COUNT(*) OVER()::int AS "skillCount" FROM assignments a JOIN assignment_submissions s ON s.assignment_id=a.id AND s.student_id=$2 JOIN assignment_skills sk ON sk.assignment_id=a.id WHERE a.id=$1 AND s.score IS NOT NULL`,[assignmentId,studentId]);for(const r of rows){const rubric=r.rubricScores||{};const specific=r.rubricEnabled&&Number.isFinite(Number(rubric[r.skillCode]));const eventScore=specific?Number(rubric[r.skillCode]):r.score;const eventMax=specific?Number(r.maxScore)/Math.max(1,Number(r.skillCount)):r.maxScore;await pool.query(`INSERT INTO student_skill_events(student_id,class_id,skill_code,source_type,source_id,score,max_score,weight,recorded_at) VALUES($1,$2,$3,'ASSIGNMENT',$4,$5,$6,$7,NOW()) ON CONFLICT(student_id,skill_code,source_type,source_id) DO UPDATE SET class_id=EXCLUDED.class_id,score=EXCLUDED.score,max_score=EXCLUDED.max_score,weight=EXCLUDED.weight,recorded_at=NOW()`,[studentId,r.classId,r.skillCode,assignmentId,eventScore,eventMax,r.weight]);}if(rows.length)await refreshLegacySummary(studentId);}
async function recordExamAttempt(attemptId){if(env.demo.enabled)return;const {rows}=await pool.query(`WITH qskills AS (SELECT s.exam_id,s.question_id,s.points,jsonb_array_elements_text(s.skill_codes) AS skill_code,1::numeric AS weight FROM exam_question_snapshots s WHERE jsonb_array_length(s.skill_codes)>0 UNION ALL SELECT eq.exam_id,eq.question_id,eq.points,qs.skill_code,qs.weight FROM exam_questions eq JOIN question_skills qs ON qs.question_id=eq.question_id WHERE NOT EXISTS(SELECT 1 FROM exam_question_snapshots s WHERE s.exam_id=eq.exam_id)) SELECT ea.student_id AS "studentId",e.class_id AS "classId",e.id AS "examId",qsk.skill_code AS "skillCode",SUM(COALESCE(ans.awarded_score,0)*qsk.weight)::float AS score,SUM(qsk.points*qsk.weight)::float AS "maxScore",AVG(qsk.weight)::float AS weight FROM exam_attempts ea JOIN exams e ON e.id=ea.exam_id JOIN qskills qsk ON qsk.exam_id=e.id LEFT JOIN exam_answers ans ON ans.attempt_id=ea.id AND ans.question_id=qsk.question_id WHERE ea.id=$1 AND ea.status IN ('GRADED','AUTO_SUBMITTED') GROUP BY ea.student_id,e.class_id,e.id,qsk.skill_code`,[attemptId]);for(const r of rows)await pool.query(`INSERT INTO student_skill_events(student_id,class_id,skill_code,source_type,source_id,score,max_score,weight,recorded_at) VALUES($1,$2,$3,'EXAM',$4,$5,$6,$7,NOW()) ON CONFLICT(student_id,skill_code,source_type,source_id) DO UPDATE SET class_id=EXCLUDED.class_id,score=EXCLUDED.score,max_score=EXCLUDED.max_score,weight=EXCLUDED.weight,recorded_at=NOW()`,[r.studentId,r.classId,r.skillCode,r.examId,r.score,r.maxScore,r.weight||1]);if(rows[0])await refreshLegacySummary(rows[0].studentId);}
async function getStudentSkillSummary(studentId,{classId=null,start=null,end=null}={}){
  if(env.demo.enabled){
    return (demoStore.studentSkills||[])
      .filter(x=>Number(x.studentId)===Number(studentId))
      .map(x=>({
        code:String(x.skill||'').toUpperCase(),skill:x.skill,score:Number(x.score),eventCount:1,
        latestScore:Number(x.score),previousScore:null,trend:null,lastRecordedAt:null,sources:['LEGACY'],
      }));
  }
  const {rows}=await pool.query(`
    WITH base AS (
      SELECT e.id,e.skill_code,e.source_type,e.recorded_at,e.weight,
             ((e.score/NULLIF(e.max_score,0))*10)::numeric AS score10
        FROM student_skill_events e
       WHERE e.student_id=$1
         AND ($2::bigint IS NULL OR e.class_id=$2)
         AND ($3::date IS NULL OR e.recorded_at >= $3::date)
         AND ($4::date IS NULL OR e.recorded_at < $4::date)
         AND e.max_score > 0
    ), ranked AS (
      SELECT b.*,ROW_NUMBER() OVER(PARTITION BY b.skill_code ORDER BY b.recorded_at DESC,b.id DESC) AS rn
        FROM base b
    ), agg AS (
      SELECT skill_code,
             ROUND((SUM(score10*weight)/NULLIF(SUM(weight),0))::numeric,2)::float AS score,
             COUNT(*)::int AS event_count,
             MAX(recorded_at) AS last_recorded_at,
             MAX(score10) FILTER(WHERE rn=1)::float AS latest_score,
             MAX(score10) FILTER(WHERE rn=2)::float AS previous_score,
             ARRAY_AGG(DISTINCT source_type ORDER BY source_type) AS sources
        FROM ranked
       GROUP BY skill_code
    )
    SELECT sk.code,sk.label AS skill,a.score,a.event_count AS "eventCount",
           ROUND(a.latest_score::numeric,2)::float AS "latestScore",
           ROUND(a.previous_score::numeric,2)::float AS "previousScore",
           CASE WHEN a.previous_score IS NULL THEN NULL
                ELSE ROUND((a.latest_score-a.previous_score)::numeric,2)::float END AS trend,
           a.last_recorded_at AS "lastRecordedAt",a.sources
      FROM agg a
      JOIN skills sk ON sk.code=a.skill_code
     WHERE sk.is_active=TRUE
     ORDER BY sk.sort_order,sk.code
  `,[studentId,classId||null,start||null,end||null]);
  return rows;
}

async function teacherDashboard(actorUserId,isAdmin=false,classId=null){
  if(env.demo.enabled){
    const classes=demoStore.classes.filter(c=>c.status!=='DELETED'&&(isAdmin||Number(c.teacherId)===Number(actorUserId)));
    const allowed=new Set(classes.filter(c=>!classId||c.id===Number(classId)).map(c=>c.id));
    const students=[];
    for(const st of demoStore.students.filter(s=>s.classIds.some(id=>allowed.has(id)))){
      for(const cid of (st.classIds||[]).filter(id=>allowed.has(id))){
        const cls=classes.find(c=>Number(c.id)===Number(cid));
        students.push({id:st.id,fullName:st.fullName,classId:cid,className:cls?.name||'',skills:(demoStore.studentSkills||[]).filter(x=>x.studentId===st.id).map(x=>({code:String(x.skill||'').toUpperCase(),skill:x.skill,score:Number(x.score),eventCount:1,latestScore:Number(x.score),trend:null,sources:['LEGACY']}))});
      }
    }
    return{classes,students};
  }
  const {rows:classes}=await pool.query(`SELECT c.id,c.name FROM classes c WHERE c.deleted_at IS NULL AND c.status='ACTIVE' AND ($2::boolean OR c.teacher_id=$1) ORDER BY c.name`,[actorUserId,isAdmin]);
  const allowed=classes.map(c=>Number(c.id));
  if(classId&&!allowed.includes(Number(classId)))throw new Error('CLASS_NOT_FOUND');
  const ids=classId?[Number(classId)]:allowed;
  if(!ids.length)return{classes,students:[]};
  const {rows}=await pool.query(`
    WITH membership AS (
      SELECT st.id AS student_id,st.full_name,c.id AS class_id,c.name AS class_name
        FROM class_students cs
        JOIN classes c ON c.id=cs.class_id AND c.deleted_at IS NULL AND c.status='ACTIVE'
        JOIN students st ON st.id=cs.student_id AND st.deleted_at IS NULL
       WHERE cs.status='ACTIVE' AND cs.class_id=ANY($1::bigint[])
    ), event_base AS (
      SELECT m.student_id,m.class_id,e.id,e.skill_code,sk.label AS skill_label,sk.sort_order,
             e.source_type,e.recorded_at,e.weight,((e.score/NULLIF(e.max_score,0))*10)::numeric AS score10
        FROM membership m
        JOIN student_skill_events e ON e.student_id=m.student_id AND e.class_id=m.class_id AND e.max_score>0
        JOIN skills sk ON sk.code=e.skill_code AND sk.is_active=TRUE
    ), ranked AS (
      SELECT eb.*,ROW_NUMBER() OVER(PARTITION BY student_id,class_id,skill_code ORDER BY recorded_at DESC,id DESC) AS rn
        FROM event_base eb
    ), skill_agg AS (
      SELECT student_id,class_id,skill_code,MAX(skill_label) AS skill_label,MAX(sort_order) AS sort_order,
             ROUND((SUM(score10*weight)/NULLIF(SUM(weight),0))::numeric,2)::float AS score,
             COUNT(*)::int AS event_count,
             MAX(score10) FILTER(WHERE rn=1)::float AS latest_score,
             MAX(score10) FILTER(WHERE rn=2)::float AS previous_score,
             MAX(recorded_at) AS last_recorded_at,
             ARRAY_AGG(DISTINCT source_type ORDER BY source_type) AS sources
        FROM ranked
       GROUP BY student_id,class_id,skill_code
    ), skill_json AS (
      SELECT student_id,class_id,
             jsonb_agg(jsonb_build_object(
               'code',skill_code,'skill',skill_label,'score',score,'eventCount',event_count,
               'latestScore',ROUND(latest_score::numeric,2)::float,
               'previousScore',ROUND(previous_score::numeric,2)::float,
               'trend',CASE WHEN previous_score IS NULL THEN NULL ELSE ROUND((latest_score-previous_score)::numeric,2)::float END,
               'lastRecordedAt',last_recorded_at,'sources',sources
             ) ORDER BY sort_order,skill_code) AS skills
        FROM skill_agg
       GROUP BY student_id,class_id
    )
    SELECT m.student_id AS id,m.full_name AS "fullName",m.class_id AS "classId",m.class_name AS "className",
           COALESCE(j.skills,'[]'::jsonb) AS skills
      FROM membership m
      LEFT JOIN skill_json j ON j.student_id=m.student_id AND j.class_id=m.class_id
     ORDER BY m.class_name,m.full_name
  `,[ids]);
  return{classes,students:rows};
}
module.exports={CATALOG,normalizeCodes,findSkills,setAssignmentSkills,getAssignmentSkills,setQuestionSkills,getQuestionSkills,recordAssignmentGrade,recordExamAttempt,getStudentSkillSummary,teacherDashboard};
