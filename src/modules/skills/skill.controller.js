const service=require('./skill.service');
async function index(req,res,next){try{res.render('skills/index',{title:'Theo dõi kỹ năng',...(await service.dashboard(req.session.user.id,req.session.user.role==='ADMIN',req.query))});}catch(e){next(e);}}
module.exports={index};
