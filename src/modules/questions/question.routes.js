const express=require('express');
const multer=require('multer');
const env=require('../../config/env');
const controller=require('./question.controller');
const {requireRole,requireApiRole}=require('../../middleware/auth.middleware');
const {requireParsedCsrfToken}=require('../../middleware/security.middleware');
const upload=multer({
  storage:multer.memoryStorage(),
  limits:{fileSize:env.question.importMaxFileMb*1024*1024},
  fileFilter:(req,file,cb)=>{
    const name=String(file.originalname||'').toLowerCase();
    if(name.endsWith('.xlsx')||name.endsWith('.csv')) return cb(null,true);
    cb(new Error('IMPORT_INVALID_FILE_TYPE'));
  }
});
function questionUpload(req,res,next){upload.single('questionFile')(req,res,(error)=>{
  if(!error)return next();
  let message='Không thể đọc file upload.';
  if(error.code==='LIMIT_FILE_SIZE')message=`File vượt quá ${env.question.importMaxFileMb} MB.`;
  if(error.message==='IMPORT_INVALID_FILE_TYPE')message='Chỉ hỗ trợ file .xlsx hoặc .csv.';
  return res.status(400).render('questions/import',{title:'Import câu hỏi hàng loạt',result:null,error:message});
});}
const web=express.Router();
web.get('/questions',requireRole('TEACHER','ADMIN'),controller.index);
web.get('/questions/import',requireRole('TEACHER','ADMIN'),controller.importForm);
web.get('/questions/import/template.xlsx',requireRole('TEACHER','ADMIN'),controller.downloadTemplate);
web.post('/questions/import',requireRole('TEACHER','ADMIN'),questionUpload,requireParsedCsrfToken,controller.importFile);
web.get('/questions/new',requireRole('TEACHER','ADMIN'),controller.newForm);
web.post('/questions',requireRole('TEACHER','ADMIN'),controller.create);
web.get('/questions/:id/edit',requireRole('TEACHER','ADMIN'),controller.editForm);
web.post('/questions/:id/update',requireRole('TEACHER','ADMIN'),controller.update);
web.post('/questions/:id/publish',requireRole('TEACHER','ADMIN'),controller.publish);
const api=express.Router(); api.get('/questions',requireApiRole('TEACHER','ADMIN'),controller.apiList);
module.exports={web,api};
