const env=require('../../config/env');
const pool=require('../../config/db');
const demoStore=require('../../shared/demo-store');

function idOf(v){const id=Number(v);return Number.isInteger(id)&&id>0?id:null;}
function nowMs(){return Date.now();}
function demoStudentId(userId){return (demoStore.studentAccounts||[]).find((x)=>x.userId===Number(userId))?.studentId||null;}

async function findClasses(){
  if(env.demo.enabled)return demoStore.classes.map((c)=>({id:c.id,name:c.name,grade:c.grade,gradeId:c.grade}));
  const {rows}=await pool.query(`SELECT c.id,c.name,c.grade_id AS "gradeId",g.grade_no AS grade FROM classes c JOIN grades g ON g.id=c.grade_id WHERE c.status='ACTIVE' ORDER BY g.grade_no,c.name`);return rows;
}

async function findAll(){
  if(env.demo.enabled){
    return (demoStore.exams||[]).map((exam)=>{
      const c=demoStore.classes.find((x)=>x.id===exam.classId);const attempts=(demoStore.examAttempts||[]).filter((a)=>a.examId===exam.id&&a.status!=='IN_PROGRESS');
      const q=(demoStore.examQuestions||[]).filter((x)=>x.examId===exam.id);
      return {...exam,className:c?.name||'',grade:c?.grade||null,questionCount:q.length,totalPoints:q.reduce((s,x)=>s+Number(x.points||1),0),submitted:attempts.length,averageScore:attempts.length?attempts.reduce((s,a)=>s+Number(a.score||0),0)/attempts.length:null};
    }).sort((a,b)=>b.id-a.id);
  }
  const {rows}=await pool.query(`
    SELECT e.id,e.class_id AS "classId",e.title,e.description,e.duration_minutes AS "durationMinutes",
           e.start_at AS "startAt",e.end_at AS "endAt",e.max_attempts AS "maxAttempts",e.show_result AS "showResult",e.status,
           c.name AS "className",g.grade_no AS grade,
           (SELECT COUNT(*)::int FROM exam_questions eq WHERE eq.exam_id=e.id) AS "questionCount",
           COALESCE((SELECT SUM(eq.points)::float FROM exam_questions eq WHERE eq.exam_id=e.id),0) AS "totalPoints",
           (SELECT COUNT(*)::int FROM exam_attempts ea WHERE ea.exam_id=e.id AND ea.status<>'IN_PROGRESS') AS submitted,
           (SELECT AVG(ea.score)::float FROM exam_attempts ea WHERE ea.exam_id=e.id AND ea.status<>'IN_PROGRESS') AS "averageScore"
      FROM exams e JOIN classes c ON c.id=e.class_id JOIN grades g ON g.id=c.grade_id
     ORDER BY e.id DESC
  `);return rows;
}

async function findById(value){
  const id=idOf(value);if(!id)return null;
  if(env.demo.enabled){
    const exam=(demoStore.exams||[]).find((x)=>x.id===id);if(!exam)return null;const c=demoStore.classes.find((x)=>x.id===exam.classId);
    const questions=(demoStore.examQuestions||[]).filter((x)=>x.examId===id).sort((a,b)=>a.sortOrder-b.sortOrder).map((link)=>{const q=(demoStore.questions||[]).find((x)=>x.id===link.questionId);return q?{...q,points:link.points,options:(demoStore.questionOptions||[]).filter((o)=>o.questionId===q.id).sort((a,b)=>a.sortOrder-b.sortOrder)}:null;}).filter(Boolean);
    const attempts=(demoStore.examAttempts||[]).filter((a)=>a.examId===id).map((a)=>({...a,studentName:demoStore.students.find((s)=>s.id===a.studentId)?.fullName||''}));
    const completed=attempts.filter((a)=>a.status!=='IN_PROGRESS');
    questions.forEach((q)=>{const answers=(demoStore.examAnswers||[]).filter((ans)=>ans.questionId===q.id&&completed.some((a)=>a.id===ans.attemptId));const correct=answers.filter((ans)=>ans.isCorrect===true).length;q.answeredCount=answers.length;q.correctCount=correct;q.accuracy=answers.length?Math.round(correct*100/answers.length):null;});
    const scores=completed.map((a)=>Number(a.score)).filter(Number.isFinite);
    const analytics={submitted:completed.length,averageScore:scores.length?scores.reduce((x,y)=>x+y,0)/scores.length:null,highestScore:scores.length?Math.max(...scores):null};
    return {...exam,className:c?.name||'',grade:c?.grade||null,questions,attempts,analytics,totalPoints:questions.reduce((s,q)=>s+Number(q.points||1),0)};
  }
  const examRes=await pool.query(`SELECT e.id,e.class_id AS "classId",e.title,e.description,e.instructions,e.duration_minutes AS "durationMinutes",e.start_at AS "startAt",e.end_at AS "endAt",e.max_attempts AS "maxAttempts",e.show_result AS "showResult",e.status,e.published_at AS "publishedAt",c.name AS "className",g.grade_no AS grade,c.grade_id AS "gradeId" FROM exams e JOIN classes c ON c.id=e.class_id JOIN grades g ON g.id=c.grade_id WHERE e.id=$1`,[id]);
  if(!examRes.rows[0])return null;
  const qRes=await pool.query(`
    SELECT q.id,q.question_type AS "questionType",q.stem,q.correct_answer AS "correctAnswer",q.explanation,q.difficulty,
           eq.sort_order AS "sortOrder",eq.points::float AS points,g.grade_no AS grade,l.title AS "lessonTitle"
      FROM exam_questions eq JOIN questions q ON q.id=eq.question_id
      LEFT JOIN grades g ON g.id=q.grade_id LEFT JOIN lessons l ON l.id=q.lesson_id
     WHERE eq.exam_id=$1 ORDER BY eq.sort_order,q.id`,[id]);
  for(const q of qRes.rows){const opts=await pool.query(`SELECT id,option_key AS "optionKey",option_text AS "optionText",is_correct AS "isCorrect",sort_order AS "sortOrder" FROM question_options WHERE question_id=$1 ORDER BY sort_order,id`,[q.id]);q.options=opts.rows;}
  const attempts=await pool.query(`SELECT ea.id,ea.student_id AS "studentId",s.full_name AS "studentName",ea.attempt_no AS "attemptNo",ea.status,ea.started_at AS "startedAt",ea.submitted_at AS "submittedAt",ea.score::float,ea.max_score::float AS "maxScore" FROM exam_attempts ea JOIN students s ON s.id=ea.student_id WHERE ea.exam_id=$1 ORDER BY ea.started_at DESC`,[id]);
  const accuracy=await pool.query(`
    SELECT eq.question_id AS "questionId",
           COUNT(ans.attempt_id)::int AS "answeredCount",
           COUNT(ans.attempt_id) FILTER(WHERE ans.is_correct=TRUE)::int AS "correctCount"
      FROM exam_questions eq
      LEFT JOIN exam_attempts ea ON ea.exam_id=eq.exam_id AND ea.status<>'IN_PROGRESS'
      LEFT JOIN exam_answers ans ON ans.attempt_id=ea.id AND ans.question_id=eq.question_id
     WHERE eq.exam_id=$1
     GROUP BY eq.question_id
  `,[id]);
  const accuracyMap=new Map(accuracy.rows.map((r)=>[Number(r.questionId),r]));
  qRes.rows.forEach((q)=>{const a=accuracyMap.get(Number(q.id))||{answeredCount:0,correctCount:0};q.answeredCount=a.answeredCount;q.correctCount=a.correctCount;q.accuracy=a.answeredCount?Math.round(a.correctCount*100/a.answeredCount):null;});
  const completed=attempts.rows.filter((a)=>a.status!=='IN_PROGRESS');const scores=completed.map((a)=>Number(a.score)).filter(Number.isFinite);
  const analytics={submitted:completed.length,averageScore:scores.length?scores.reduce((x,y)=>x+y,0)/scores.length:null,highestScore:scores.length?Math.max(...scores):null};
  return {...examRes.rows[0],questions:qRes.rows,attempts:attempts.rows,analytics,totalPoints:qRes.rows.reduce((s,q)=>s+Number(q.points),0)};
}

async function create(data,userId){
  if(env.demo.enabled){
    demoStore.exams=demoStore.exams||[];demoStore.examQuestions=demoStore.examQuestions||[];const id=Math.max(0,...demoStore.exams.map((e)=>e.id))+1;
    const exam={id,classId:Number(data.classId),title:data.title,description:data.description,instructions:data.instructions,durationMinutes:data.durationMinutes,startAt:data.startAt||null,endAt:data.endAt||null,maxAttempts:data.maxAttempts,showResult:data.showResult,status:'DRAFT',createdBy:Number(userId)};demoStore.exams.push(exam);
    data.questionIds.forEach((qid,index)=>{const q=(demoStore.questions||[]).find((x)=>x.id===qid);if(q&&q.status==='PUBLISHED')demoStore.examQuestions.push({examId:id,questionId:qid,sortOrder:index+1,points:Number(q.defaultPoints||1)});});return exam;
  }
  const client=await pool.connect();
  try{await client.query('BEGIN');
    const classRes=await client.query(`SELECT grade_id FROM classes WHERE id=$1 AND status='ACTIVE'`,[data.classId]);if(!classRes.rows[0])throw new Error('CLASS_NOT_FOUND');
    const qRes=await client.query(`SELECT id,default_points FROM questions WHERE id=ANY($1::bigint[]) AND status='PUBLISHED' AND (grade_id IS NULL OR grade_id=$2)`,[data.questionIds,classRes.rows[0].grade_id]);if(qRes.rows.length!==data.questionIds.length)throw new Error('INVALID_QUESTIONS');
    const {rows}=await client.query(`INSERT INTO exams(class_id,title,description,instructions,duration_minutes,start_at,end_at,max_attempts,show_result,status,created_by) VALUES($1,$2,NULLIF($3,''),NULLIF($4,''),$5,NULLIF($6,'')::timestamptz,NULLIF($7,'')::timestamptz,$8,$9,'DRAFT',$10) RETURNING id`,[data.classId,data.title,data.description||'',data.instructions||'',data.durationMinutes,data.startAt||'',data.endAt||'',data.maxAttempts,data.showResult,userId]);
    const byId=new Map(qRes.rows.map((q)=>[Number(q.id),Number(q.default_points)]));
    for(let i=0;i<data.questionIds.length;i++)await client.query(`INSERT INTO exam_questions(exam_id,question_id,sort_order,points) VALUES($1,$2,$3,$4)`,[rows[0].id,data.questionIds[i],i+1,byId.get(data.questionIds[i])||1]);
    await client.query('COMMIT');return findById(rows[0].id);
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}


async function update(value,data){
  const id=idOf(value);if(!id)throw new Error('EXAM_NOT_FOUND');
  if(env.demo.enabled){const exam=(demoStore.exams||[]).find((e)=>e.id===id);if(!exam)throw new Error('EXAM_NOT_FOUND');if(exam.status!=='DRAFT')throw new Error('EXAM_NOT_EDITABLE');Object.assign(exam,{classId:Number(data.classId),title:data.title,description:data.description,instructions:data.instructions,durationMinutes:data.durationMinutes,startAt:data.startAt||null,endAt:data.endAt||null,maxAttempts:data.maxAttempts,showResult:data.showResult});demoStore.examQuestions=(demoStore.examQuestions||[]).filter((x)=>x.examId!==id);data.questionIds.forEach((qid,index)=>{const q=(demoStore.questions||[]).find((x)=>x.id===qid&&x.status==='PUBLISHED');if(q)demoStore.examQuestions.push({examId:id,questionId:qid,sortOrder:index+1,points:Number(q.defaultPoints||1)});});return findById(id);}
  const client=await pool.connect();try{await client.query('BEGIN');const existing=await client.query(`SELECT status FROM exams WHERE id=$1 FOR UPDATE`,[id]);if(!existing.rows[0])throw new Error('EXAM_NOT_FOUND');if(existing.rows[0].status!=='DRAFT')throw new Error('EXAM_NOT_EDITABLE');const classRes=await client.query(`SELECT grade_id FROM classes WHERE id=$1 AND status='ACTIVE'`,[data.classId]);if(!classRes.rows[0])throw new Error('CLASS_NOT_FOUND');const qRes=await client.query(`SELECT id,default_points FROM questions WHERE id=ANY($1::bigint[]) AND status='PUBLISHED' AND (grade_id IS NULL OR grade_id=$2)`,[data.questionIds,classRes.rows[0].grade_id]);if(qRes.rows.length!==data.questionIds.length)throw new Error('INVALID_QUESTIONS');await client.query(`UPDATE exams SET class_id=$2,title=$3,description=NULLIF($4,''),instructions=NULLIF($5,''),duration_minutes=$6,start_at=NULLIF($7,'')::timestamptz,end_at=NULLIF($8,'')::timestamptz,max_attempts=$9,show_result=$10,updated_at=NOW() WHERE id=$1`,[id,data.classId,data.title,data.description||'',data.instructions||'',data.durationMinutes,data.startAt||'',data.endAt||'',data.maxAttempts,data.showResult]);await client.query(`DELETE FROM exam_questions WHERE exam_id=$1`,[id]);const byId=new Map(qRes.rows.map((q)=>[Number(q.id),Number(q.default_points)]));for(let i=0;i<data.questionIds.length;i++)await client.query(`INSERT INTO exam_questions(exam_id,question_id,sort_order,points) VALUES($1,$2,$3,$4)`,[id,data.questionIds[i],i+1,byId.get(data.questionIds[i])||1]);await client.query('COMMIT');return findById(id);}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}

async function close(value){const id=idOf(value);if(!id)throw new Error('EXAM_NOT_FOUND');if(env.demo.enabled){const e=(demoStore.exams||[]).find((x)=>x.id===id);if(!e)throw new Error('EXAM_NOT_FOUND');e.status='CLOSED';return e;}const {rows}=await pool.query(`UPDATE exams SET status='CLOSED',updated_at=NOW() WHERE id=$1 RETURNING id,status`,[id]);if(!rows[0])throw new Error('EXAM_NOT_FOUND');return rows[0];}

async function publish(value){const id=idOf(value);if(!id)throw new Error('EXAM_NOT_FOUND');if(env.demo.enabled){const e=(demoStore.exams||[]).find((x)=>x.id===id);if(!e)throw new Error('EXAM_NOT_FOUND');e.status='PUBLISHED';e.publishedAt=new Date().toISOString();return e;}const {rows}=await pool.query(`UPDATE exams SET status='PUBLISHED',published_at=NOW(),updated_at=NOW() WHERE id=$1 AND EXISTS(SELECT 1 FROM exam_questions WHERE exam_id=$1) RETURNING id,status`,[id]);if(!rows[0])throw new Error('EXAM_EMPTY_OR_NOT_FOUND');return rows[0];}

async function findStudentExams(userId){
  if(env.demo.enabled){const sid=demoStudentId(userId);const student=demoStore.students.find((s)=>s.id===sid);if(!student)return[];return (demoStore.exams||[]).filter((e)=>['PUBLISHED','CLOSED'].includes(e.status)&&student.classIds.includes(e.classId)).map((e)=>{const attempts=(demoStore.examAttempts||[]).filter((a)=>a.examId===e.id&&a.studentId===sid);return{...e,className:demoStore.classes.find((c)=>c.id===e.classId)?.name||'',attempts:attempts.length,lastAttempt:attempts.sort((a,b)=>b.attemptNo-a.attemptNo)[0]||null};});}
  const {rows}=await pool.query(`
    SELECT e.id,e.title,e.description,e.duration_minutes AS "durationMinutes",e.start_at AS "startAt",e.end_at AS "endAt",e.max_attempts AS "maxAttempts",e.show_result AS "showResult",e.status,c.name AS "className",
           COUNT(ea.id)::int AS attempts,
           MAX(ea.attempt_no)::int AS "lastAttemptNo",
           (ARRAY_AGG(ea.status ORDER BY ea.attempt_no DESC) FILTER(WHERE ea.id IS NOT NULL))[1] AS "lastStatus",
           (ARRAY_AGG(ea.score ORDER BY ea.attempt_no DESC) FILTER(WHERE ea.id IS NOT NULL))[1]::float AS "lastScore",
           (ARRAY_AGG(ea.id ORDER BY ea.attempt_no DESC) FILTER(WHERE ea.id IS NOT NULL))[1] AS "lastAttemptId"
      FROM student_accounts sa JOIN class_students cs ON cs.student_id=sa.student_id AND cs.status='ACTIVE'
      JOIN exams e ON e.class_id=cs.class_id AND e.status IN ('PUBLISHED','CLOSED') JOIN classes c ON c.id=e.class_id
      LEFT JOIN exam_attempts ea ON ea.exam_id=e.id AND ea.student_id=sa.student_id
     WHERE sa.user_id=$1 GROUP BY e.id,c.id ORDER BY e.start_at NULLS FIRST,e.id DESC
  `,[userId]);return rows;
}

async function startAttempt(examIdValue,userId){
  const examId=idOf(examIdValue);if(!examId)throw new Error('EXAM_NOT_FOUND');
  if(env.demo.enabled){const sid=demoStudentId(userId);const exam=(demoStore.exams||[]).find((e)=>e.id===examId&&e.status==='PUBLISHED');const student=demoStore.students.find((s)=>s.id===sid);if(!exam||!student||!student.classIds.includes(exam.classId))throw new Error('EXAM_NOT_AVAILABLE');const active=(demoStore.examAttempts||[]).find((a)=>a.examId===examId&&a.studentId===sid&&a.status==='IN_PROGRESS');if(active)return active;const count=(demoStore.examAttempts||[]).filter((a)=>a.examId===examId&&a.studentId===sid).length;if(count>=exam.maxAttempts)throw new Error('MAX_ATTEMPTS_REACHED');demoStore.examAttempts=demoStore.examAttempts||[];const attempt={id:Math.max(0,...demoStore.examAttempts.map((a)=>a.id))+1,examId,studentId:sid,attemptNo:count+1,status:'IN_PROGRESS',startedAt:new Date().toISOString(),lastSavedAt:null,score:null,maxScore:null};demoStore.examAttempts.push(attempt);return attempt;}
  const client=await pool.connect();
  try{await client.query('BEGIN');
    const student=await client.query(`SELECT student_id FROM student_accounts WHERE user_id=$1`,[userId]);if(!student.rows[0])throw new Error('STUDENT_NOT_FOUND');const sid=student.rows[0].student_id;
    const exam=await client.query(`SELECT e.*,EXISTS(SELECT 1 FROM class_students cs WHERE cs.class_id=e.class_id AND cs.student_id=$2 AND cs.status='ACTIVE') AS member FROM exams e WHERE e.id=$1 FOR UPDATE`,[examId,sid]);const e=exam.rows[0];if(!e||e.status!=='PUBLISHED'||!e.member)throw new Error('EXAM_NOT_AVAILABLE');const now=new Date();if(e.start_at&&now<new Date(e.start_at))throw new Error('EXAM_NOT_STARTED');if(e.end_at&&now>new Date(e.end_at))throw new Error('EXAM_CLOSED');
    const active=await client.query(`SELECT id FROM exam_attempts WHERE exam_id=$1 AND student_id=$2 AND status='IN_PROGRESS' ORDER BY attempt_no DESC LIMIT 1`,[examId,sid]);if(active.rows[0]){await client.query('COMMIT');return {id:active.rows[0].id};}
    const count=await client.query(`SELECT COUNT(*)::int AS count FROM exam_attempts WHERE exam_id=$1 AND student_id=$2`,[examId,sid]);if(count.rows[0].count>=e.max_attempts)throw new Error('MAX_ATTEMPTS_REACHED');
    const {rows}=await client.query(`INSERT INTO exam_attempts(exam_id,student_id,attempt_no,status) VALUES($1,$2,$3,'IN_PROGRESS') RETURNING id,attempt_no AS "attemptNo",started_at AS "startedAt"`,[examId,sid,count.rows[0].count+1]);await client.query('COMMIT');return rows[0];
  }catch(err){await client.query('ROLLBACK');throw err;}finally{client.release();}
}

async function findAttempt(attemptIdValue,userId){
  const attemptId=idOf(attemptIdValue);if(!attemptId)return null;
  if(env.demo.enabled){const sid=demoStudentId(userId);const a=(demoStore.examAttempts||[]).find((x)=>x.id===attemptId&&x.studentId===sid);if(!a)return null;const exam=await findById(a.examId);const answers=(demoStore.examAnswers||[]).filter((x)=>x.attemptId===attemptId);const deadline=new Date(new Date(a.startedAt).getTime()+exam.durationMinutes*60000).toISOString();return{...a,exam,answers,deadline};}
  const aRes=await pool.query(`SELECT ea.id,ea.exam_id AS "examId",ea.student_id AS "studentId",ea.attempt_no AS "attemptNo",ea.status,ea.started_at AS "startedAt",ea.submitted_at AS "submittedAt",ea.score::float,ea.max_score::float AS "maxScore",e.duration_minutes AS "durationMinutes",e.show_result AS "showResult",e.title FROM exam_attempts ea JOIN exams e ON e.id=ea.exam_id JOIN student_accounts sa ON sa.student_id=ea.student_id WHERE ea.id=$1 AND sa.user_id=$2`,[attemptId,userId]);if(!aRes.rows[0])return null;const a=aRes.rows[0];const exam=await findById(a.examId);const ans=await pool.query(`SELECT question_id AS "questionId",selected_option_id AS "selectedOptionId",COALESCE(answer_text,'') AS "answerText",is_correct AS "isCorrect",awarded_score::float AS "awardedScore" FROM exam_answers WHERE attempt_id=$1`,[attemptId]);const deadline=new Date(new Date(a.startedAt).getTime()+a.durationMinutes*60000).toISOString();return{...a,exam,answers:ans.rows,deadline};
}

async function saveAnswer(attemptIdValue,userId,data){
  const attemptId=idOf(attemptIdValue),questionId=idOf(data.questionId);if(!attemptId||!questionId)throw new Error('INVALID_ANSWER');
  if(env.demo.enabled){const sid=demoStudentId(userId);const a=(demoStore.examAttempts||[]).find((x)=>x.id===attemptId&&x.studentId===sid&&x.status==='IN_PROGRESS');if(!a)throw new Error('ATTEMPT_NOT_ACTIVE');const exam=(demoStore.exams||[]).find((e)=>e.id===a.examId);if(exam&&Date.now()>new Date(a.startedAt).getTime()+Number(exam.durationMinutes)*60000)throw new Error('ATTEMPT_EXPIRED');const valid=(demoStore.examQuestions||[]).some((x)=>x.examId===a.examId&&x.questionId===questionId);if(!valid)throw new Error('QUESTION_NOT_IN_EXAM');demoStore.examAnswers=demoStore.examAnswers||[];let ans=demoStore.examAnswers.find((x)=>x.attemptId===attemptId&&x.questionId===questionId);if(!ans){ans={attemptId,questionId};demoStore.examAnswers.push(ans);}ans.selectedOptionId=data.selectedOptionId?Number(data.selectedOptionId):null;ans.answerText=String(data.answerText||'');ans.savedAt=new Date().toISOString();a.lastSavedAt=ans.savedAt;return ans;}
  const ownership=await pool.query(`SELECT ea.exam_id FROM exam_attempts ea JOIN student_accounts sa ON sa.student_id=ea.student_id JOIN exams e ON e.id=ea.exam_id WHERE ea.id=$1 AND sa.user_id=$2 AND ea.status='IN_PROGRESS' AND NOW() <= ea.started_at + (e.duration_minutes::text || ' minute')::interval`,[attemptId,userId]);if(!ownership.rows[0])throw new Error('ATTEMPT_NOT_ACTIVE');const valid=await pool.query(`SELECT q.question_type FROM exam_questions eq JOIN questions q ON q.id=eq.question_id WHERE eq.exam_id=$1 AND eq.question_id=$2`,[ownership.rows[0].exam_id,questionId]);if(!valid.rows[0])throw new Error('QUESTION_NOT_IN_EXAM');let selected=null;if(data.selectedOptionId){const opt=await pool.query(`SELECT id FROM question_options WHERE id=$1 AND question_id=$2`,[data.selectedOptionId,questionId]);if(!opt.rows[0])throw new Error('INVALID_OPTION');selected=opt.rows[0].id;}
  const {rows}=await pool.query(`INSERT INTO exam_answers(attempt_id,question_id,selected_option_id,answer_text,saved_at) VALUES($1,$2,$3,NULLIF($4,''),NOW()) ON CONFLICT(attempt_id,question_id) DO UPDATE SET selected_option_id=EXCLUDED.selected_option_id,answer_text=EXCLUDED.answer_text,saved_at=NOW() RETURNING question_id AS "questionId",selected_option_id AS "selectedOptionId",answer_text AS "answerText",saved_at AS "savedAt"`,[attemptId,questionId,selected,String(data.answerText||'')]);await pool.query(`UPDATE exam_attempts SET last_saved_at=NOW() WHERE id=$1`,[attemptId]);return rows[0];
}

async function gradeAttempt(attemptIdValue,userId,autoSubmitted=false){
  const attemptId=idOf(attemptIdValue);if(!attemptId)throw new Error('ATTEMPT_NOT_FOUND');
  if(env.demo.enabled){const sid=demoStudentId(userId);const a=(demoStore.examAttempts||[]).find((x)=>x.id===attemptId&&x.studentId===sid&&x.status==='IN_PROGRESS');if(!a)throw new Error('ATTEMPT_NOT_ACTIVE');const exam=await findById(a.examId);let score=0,max=0;demoStore.examAnswers=demoStore.examAnswers||[];for(const q of exam.questions){max+=Number(q.points);let ans=demoStore.examAnswers.find((x)=>x.attemptId===attemptId&&x.questionId===q.id);if(!ans){ans={attemptId,questionId:q.id,selectedOptionId:null,answerText:''};demoStore.examAnswers.push(ans);}let correct=false;if(q.questionType==='FILL_BLANK')correct=String(ans.answerText||'').trim().toLowerCase()===String(q.correctAnswer||'').trim().toLowerCase();else correct=q.options.some((o)=>o.id===Number(ans.selectedOptionId)&&o.isCorrect);ans.isCorrect=correct;ans.awardedScore=correct?Number(q.points):0;score+=ans.awardedScore;}a.status=autoSubmitted?'AUTO_SUBMITTED':'GRADED';a.submittedAt=new Date().toISOString();a.score=score;a.maxScore=max;demoStore.studentScores=demoStore.studentScores||[];let scoreRow=demoStore.studentScores.find((x)=>x.studentId===sid&&x.examId===a.examId);if(!scoreRow){scoreRow={id:Math.max(0,...demoStore.studentScores.map((x)=>x.id||0))+1,studentId:sid,examId:a.examId,title:exam.title,category:'EXAM',score,maxScore:max,recordedAt:new Date().toISOString().slice(0,10)};demoStore.studentScores.push(scoreRow);}else{Object.assign(scoreRow,{score,maxScore:max,recordedAt:new Date().toISOString().slice(0,10)});}const st=demoStore.students.find((x)=>x.id===sid);if(st){const rows=demoStore.studentScores.filter((x)=>x.studentId===sid&&Number(x.maxScore)>0);if(rows.length)st.averageScore=Math.round(rows.reduce((sum,x)=>sum+(Number(x.score)/Number(x.maxScore))*10,0)/rows.length*100)/100;}return a;}
  const client=await pool.connect();try{await client.query('BEGIN');
    const aRes=await client.query(`SELECT ea.*,e.title,e.id AS exam_ref FROM exam_attempts ea JOIN exams e ON e.id=ea.exam_id JOIN student_accounts sa ON sa.student_id=ea.student_id WHERE ea.id=$1 AND sa.user_id=$2 FOR UPDATE`,[attemptId,userId]);const a=aRes.rows[0];if(!a||a.status!=='IN_PROGRESS')throw new Error('ATTEMPT_NOT_ACTIVE');
    const questions=await client.query(`SELECT q.id,q.question_type,q.correct_answer,eq.points::float FROM exam_questions eq JOIN questions q ON q.id=eq.question_id WHERE eq.exam_id=$1 ORDER BY eq.sort_order`,[a.exam_id]);let score=0,max=0;
    for(const q of questions.rows){max+=Number(q.points);const ansRes=await client.query(`SELECT selected_option_id,COALESCE(answer_text,'') AS answer_text FROM exam_answers WHERE attempt_id=$1 AND question_id=$2`,[attemptId,q.id]);const ans=ansRes.rows[0]||{selected_option_id:null,answer_text:''};let correct=false;if(q.question_type==='FILL_BLANK'){correct=String(ans.answer_text||'').trim().toLocaleLowerCase()===String(q.correct_answer||'').trim().toLocaleLowerCase();}else if(ans.selected_option_id){const opt=await client.query(`SELECT is_correct FROM question_options WHERE id=$1 AND question_id=$2`,[ans.selected_option_id,q.id]);correct=Boolean(opt.rows[0]?.is_correct);}const awarded=correct?Number(q.points):0;score+=awarded;await client.query(`INSERT INTO exam_answers(attempt_id,question_id,selected_option_id,answer_text,is_correct,awarded_score,saved_at) VALUES($1,$2,$3,NULLIF($4,''),$5,$6,NOW()) ON CONFLICT(attempt_id,question_id) DO UPDATE SET is_correct=EXCLUDED.is_correct,awarded_score=EXCLUDED.awarded_score,saved_at=NOW()`,[attemptId,q.id,ans.selected_option_id,ans.answer_text,correct,awarded]);}
    await client.query(`UPDATE exam_attempts SET status=$2,submitted_at=NOW(),last_saved_at=NOW(),score=$3,max_score=$4 WHERE id=$1`,[attemptId,autoSubmitted?'AUTO_SUBMITTED':'GRADED',score,max]);
    await client.query(`INSERT INTO student_scores(student_id,exam_id,title,category,score,max_score,recorded_at) VALUES($1,$2,$3,'EXAM',$4,$5,CURRENT_DATE) ON CONFLICT(student_id,exam_id) WHERE exam_id IS NOT NULL DO UPDATE SET score=EXCLUDED.score,max_score=EXCLUDED.max_score,recorded_at=CURRENT_DATE`,[a.student_id,a.exam_id,a.title,score,max]);
    await client.query(`INSERT INTO student_progress_summary(student_id,average_score,attendance_rate) VALUES($1,0,0) ON CONFLICT(student_id) DO NOTHING`,[a.student_id]);
    await client.query(`UPDATE student_progress_summary sp SET average_score=COALESCE(src.avg_score,0),updated_at=NOW() FROM (SELECT student_id,ROUND(AVG((score/NULLIF(max_score,0))*10)::numeric,2) AS avg_score FROM student_scores WHERE student_id=$1 GROUP BY student_id) src WHERE sp.student_id=src.student_id`,[a.student_id]);
    await client.query('COMMIT');return {id:attemptId,score,maxScore:max,status:autoSubmitted?'AUTO_SUBMITTED':'GRADED'};
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}

module.exports={findClasses,findAll,findById,create,update,publish,close,findStudentExams,startAttempt,findAttempt,saveAnswer,gradeAttempt};
