const repo=require('./skill.repository');
async function dashboard(userId,isAdmin,query={}){return {...await repo.teacherDashboard(userId,isAdmin,query.classId||null),skills:await repo.findSkills(),selectedClassId:Number(query.classId)||null};}
module.exports={dashboard};
