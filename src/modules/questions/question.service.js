const env = require('../../config/env');
const repo = require('./question.repository');
const TYPES = ['MULTIPLE_CHOICE','TRUE_FALSE','FILL_BLANK'];
const DIFFICULTIES = ['EASY','MEDIUM','HARD'];
function clean(v){ return String(v || '').trim(); }
function parse(body){
  const questionType = TYPES.includes(body.questionType) ? body.questionType : 'MULTIPLE_CHOICE';
  const difficulty = DIFFICULTIES.includes(body.difficulty) ? body.difficulty : 'MEDIUM';
  const stem = clean(body.stem); if(!stem) throw new Error('STEM_REQUIRED');
  const defaultPoints=Number(body.defaultPoints||env.question.defaultPoints); if(!Number.isFinite(defaultPoints)||defaultPoints<=0||defaultPoints>env.question.maxPoints) throw new Error('INVALID_POINTS');
  const data={gradeId:body.gradeId?Number(body.gradeId):null,lessonId:body.lessonId?Number(body.lessonId):null,questionType,stem,correctAnswer:clean(body.correctAnswer),explanation:clean(body.explanation),difficulty,defaultPoints,correctOption:clean(body.correctOption),options:{A:clean(body.optionA),B:clean(body.optionB),C:clean(body.optionC),D:clean(body.optionD)}};
  if(questionType==='FILL_BLANK'&&!data.correctAnswer) throw new Error('CORRECT_ANSWER_REQUIRED');
  if(questionType==='TRUE_FALSE'&&!['A','B'].includes(data.correctOption)) throw new Error('CORRECT_OPTION_REQUIRED');
  if(questionType==='MULTIPLE_CHOICE'){
    const filled=Object.entries(data.options).filter(([,text])=>text); if(filled.length<2) throw new Error('OPTIONS_REQUIRED');
    if(!filled.some(([key])=>key===data.correctOption)) throw new Error('CORRECT_OPTION_REQUIRED');
  }
  return data;
}
async function list(filters){const [questions,grades]=await Promise.all([repo.findAll(filters),repo.findGrades()]);return{questions,grades,filters};}
async function form(id=null){const [grades,lessons,question]=await Promise.all([repo.findGrades(),repo.findLessons(),id?repo.findById(id):Promise.resolve(null)]);return{grades,lessons,question};}
async function create(body,userId){return repo.create(parse(body),userId);}
async function update(id,body){return repo.update(id,parse(body));}
async function publish(id){const q=await repo.findById(id);if(!q)throw new Error('QUESTION_NOT_FOUND');if(q.questionType!=='FILL_BLANK'&&!q.options.some((o)=>o.isCorrect))throw new Error('QUESTION_NO_CORRECT_ANSWER');return repo.publish(id);}
module.exports={list,form,create,update,publish};
