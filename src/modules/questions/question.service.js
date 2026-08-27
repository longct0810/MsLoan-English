const env = require('../../config/env');
const repo = require('./question.repository');
const { parseQuestionFile, buildTemplateBuffer } = require('./question.import');

const TYPES = ['MULTIPLE_CHOICE','TRUE_FALSE','FILL_BLANK','ESSAY'];
const DIFFICULTIES = ['EASY','MEDIUM','HARD'];
const STATUSES = ['DRAFT','PUBLISHED'];

function clean(v){ return String(v || '').trim(); }
function normalizeType(value){
  const v=clean(value).toUpperCase().replace(/[\s-]+/g,'_');
  const map={MCQ:'MULTIPLE_CHOICE',TRAC_NGHIEM:'MULTIPLE_CHOICE',TRUEFALSE:'TRUE_FALSE',TF:'TRUE_FALSE',DIEN_TU:'FILL_BLANK',FILL:'FILL_BLANK',TU_LUAN:'ESSAY',WRITING:'ESSAY'};
  return map[v]||v;
}
function normalizeDifficulty(value){const v=clean(value).toUpperCase();return DIFFICULTIES.includes(v)?v:'MEDIUM';}
function normalizeStatus(value){const v=clean(value).toUpperCase();return STATUSES.includes(v)?v:'DRAFT';}
function normalizeCorrectOption(value, type){
  let v=clean(value).toUpperCase();
  if(type==='TRUE_FALSE'){ if(v==='TRUE')v='A'; if(v==='FALSE')v='B'; }
  return v;
}

function validateData(data){
  if(!TYPES.includes(data.questionType)) throw new Error('INVALID_QUESTION_TYPE');
  if(!data.stem) throw new Error('STEM_REQUIRED');
  if(!Number.isFinite(data.defaultPoints)||data.defaultPoints<=0||data.defaultPoints>env.question.maxPoints) throw new Error('INVALID_POINTS');
  if(data.questionType==='FILL_BLANK'&&!data.correctAnswer) throw new Error('CORRECT_ANSWER_REQUIRED');
  if(data.questionType==='TRUE_FALSE'&&!['A','B'].includes(data.correctOption)) throw new Error('CORRECT_OPTION_REQUIRED');
  if(data.questionType==='MULTIPLE_CHOICE'){
    const filled=Object.entries(data.options||{}).filter(([,text])=>clean(text));
    if(filled.length<2) throw new Error('OPTIONS_REQUIRED');
    if(!filled.some(([key])=>key===data.correctOption)) throw new Error('CORRECT_OPTION_REQUIRED');
  }
  return data;
}

function parse(body){
  const questionType = TYPES.includes(body.questionType) ? body.questionType : 'MULTIPLE_CHOICE';
  const difficulty = DIFFICULTIES.includes(body.difficulty) ? body.difficulty : 'MEDIUM';
  const stem = clean(body.stem);
  const defaultPoints=Number(body.defaultPoints||env.question.defaultPoints);
  return validateData({
    gradeId:body.gradeId?Number(body.gradeId):null,
    lessonId:body.lessonId?Number(body.lessonId):null,
    questionType,stem,
    correctAnswer:clean(questionType==='ESSAY' ? body.essayModelAnswer : body.correctAnswer),
    explanation:clean(body.explanation),
    difficulty,defaultPoints,
    correctOption:clean(body.correctOption),
    options:{A:clean(body.optionA),B:clean(body.optionB),C:clean(body.optionC),D:clean(body.optionD)},
  });
}

async function list(filters){const [questions,grades]=await Promise.all([repo.findAll(filters),repo.findGrades()]);return{questions,grades,filters};}
async function form(id=null){const [grades,lessons,question]=await Promise.all([repo.findGrades(),repo.findLessons(),id?repo.findById(id):Promise.resolve(null)]);return{grades,lessons,question};}
async function create(body,userId){return repo.create(parse(body),userId);}
async function update(id,body){return repo.update(id,parse(body));}
async function publish(id){const q=await repo.findById(id);if(!q)throw new Error('QUESTION_NOT_FOUND');if(['MULTIPLE_CHOICE','TRUE_FALSE'].includes(q.questionType)&&!q.options.some((o)=>o.isCorrect))throw new Error('QUESTION_NO_CORRECT_ANSWER');if(q.questionType==='FILL_BLANK'&&!clean(q.correctAnswer))throw new Error('QUESTION_NO_CORRECT_ANSWER');return repo.publish(id);}

function importError(rowNo, message){ return { rowNo, message }; }
function humanImportError(code){
  const map={
    INVALID_ACTION:'action chỉ nhận CREATE hoặc UPDATE.',
    UPDATE_ID_REQUIRED:'UPDATE bắt buộc có id.',
    QUESTION_NOT_FOUND:'Không tìm thấy question id cần cập nhật.',
    INVALID_GRADE:'Khối chỉ nhận 6, 7, 8, 9 hoặc để trống.',
    INVALID_LESSON:'lesson_id không tồn tại.',
    INVALID_QUESTION_TYPE:'question_type không hợp lệ.',
    STEM_REQUIRED:'Thiếu nội dung câu hỏi (stem).',
    INVALID_POINTS:`points phải > 0 và <= ${env.question.maxPoints}.`,
    CORRECT_ANSWER_REQUIRED:'Câu điền từ cần correct_answer.',
    CORRECT_OPTION_REQUIRED:'Thiếu/không đúng correct_option.',
    OPTIONS_REQUIRED:'Câu trắc nghiệm cần ít nhất 2 lựa chọn.',
    INVALID_STATUS:'status chỉ nhận DRAFT hoặc PUBLISHED.',
  }; return map[code]||code;
}

async function prepareImportRows(rawRows){
  const [grades,lessons]=await Promise.all([repo.findGrades(),repo.findLessons()]);
  const gradeMap=new Map(grades.map(g=>[Number(g.gradeNo),Number(g.id)]));
  const lessonIds=new Set(lessons.map(l=>Number(l.id)));
  const updateIds=rawRows.map(r=>Number(r.id)).filter(x=>Number.isInteger(x)&&x>0);
  const existingIds=await repo.findExistingIds(updateIds);
  const errors=[]; const items=[];

  for(const row of rawRows){
    try{
      const id=Number(row.id||0);
      let action=clean(row.action).toUpperCase(); if(!action) action=id?'UPDATE':'CREATE';
      if(!['CREATE','UPDATE'].includes(action)) throw new Error('INVALID_ACTION');
      if(action==='UPDATE'&&(!Number.isInteger(id)||id<=0)) throw new Error('UPDATE_ID_REQUIRED');
      if(action==='UPDATE'&&!existingIds.has(id)) throw new Error('QUESTION_NOT_FOUND');

      let gradeId=null;
      if(clean(row.grade)){
        const grade=Number(row.grade); if(![6,7,8,9].includes(grade)||!gradeMap.has(grade)) throw new Error('INVALID_GRADE');
        gradeId=gradeMap.get(grade);
      }
      let lessonId=null;
      if(clean(row.lessonId)){ lessonId=Number(row.lessonId); if(!Number.isInteger(lessonId)||!lessonIds.has(lessonId)) throw new Error('INVALID_LESSON'); }

      const questionType=normalizeType(row.questionType);
      const difficulty=normalizeDifficulty(row.difficulty);
      const statusText=clean(row.status);
      if(statusText&&!STATUSES.includes(statusText.toUpperCase())) throw new Error('INVALID_STATUS');
      const status=statusText?normalizeStatus(statusText):(action==='UPDATE'?null:'DRAFT');
      const data=validateData({
        action,id:action==='UPDATE'?id:null,gradeId,lessonId,questionType,
        stem:clean(row.stem),correctAnswer:clean(row.correctAnswer),explanation:clean(row.explanation),difficulty,
        defaultPoints:Number(clean(row.points)||env.question.defaultPoints),
        correctOption:normalizeCorrectOption(row.correctOption,questionType),
        options:{A:clean(row.optionA),B:clean(row.optionB),C:clean(row.optionC),D:clean(row.optionD)},
        status,
      });
      items.push(data);
    }catch(error){errors.push(importError(row.rowNo,humanImportError(error.message)));}
  }
  return {items,errors};
}

async function importQuestions(file,userId){
  const rawRows=await parseQuestionFile(file,env.question.importMaxRows);
  const {items,errors}=await prepareImportRows(rawRows);
  if(errors.length) return {ok:false,totalRows:rawRows.length,errors,created:0,updated:0};
  const result=await repo.bulkUpsert(items,userId);
  return {ok:true,totalRows:rawRows.length,errors:[],...result};
}
async function template(){return buildTemplateBuffer();}

module.exports={list,form,create,update,publish,importQuestions,template};
