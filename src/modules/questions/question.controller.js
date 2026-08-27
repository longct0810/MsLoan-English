const service=require('./question.service');
function message(error){const map={STEM_REQUIRED:'Vui lòng nhập nội dung câu hỏi.',INVALID_POINTS:'Điểm câu hỏi không hợp lệ.',CORRECT_ANSWER_REQUIRED:'Vui lòng nhập đáp án đúng.',CORRECT_OPTION_REQUIRED:'Vui lòng chọn đáp án đúng.',OPTIONS_REQUIRED:'Trắc nghiệm cần ít nhất 2 lựa chọn.',QUESTION_NOT_FOUND:'Không tìm thấy câu hỏi.',QUESTION_NO_CORRECT_ANSWER:'Câu hỏi chưa có đáp án đúng.'};return map[error.message]||error.message;}
async function index(req,res,next){try{const data=await service.list(req.query);res.render('questions/index',{title:'Ngân hàng câu hỏi',...data});}catch(e){next(e);}}
async function newForm(req,res,next){try{res.render('questions/form',{title:'Thêm câu hỏi',...(await service.form()),error:null,form:null});}catch(e){next(e);}}
async function create(req,res,next){try{const q=await service.create(req.body,req.session.user.id);res.redirect(`/questions/${q.id}/edit`);}catch(e){try{res.status(400).render('questions/form',{title:'Thêm câu hỏi',...(await service.form()),error:message(e),form:req.body});}catch(x){next(x);}}}
async function editForm(req,res,next){try{const data=await service.form(req.params.id);if(!data.question)return res.status(404).render('errors/404',{title:'Không tìm thấy câu hỏi'});res.render('questions/form',{title:'Sửa câu hỏi',...data,error:null,form:null});}catch(e){next(e);}}
async function update(req,res,next){try{await service.update(req.params.id,req.body);res.redirect('/questions');}catch(e){try{const data=await service.form(req.params.id);res.status(400).render('questions/form',{title:'Sửa câu hỏi',...data,error:message(e),form:req.body});}catch(x){next(x);}}}
async function publish(req,res,next){try{await service.publish(req.params.id);res.redirect('/questions');}catch(e){next(e);}}
async function apiList(req,res,next){try{res.json(await service.list(req.query));}catch(e){next(e);}}
module.exports={index,newForm,create,editForm,update,publish,apiList};
