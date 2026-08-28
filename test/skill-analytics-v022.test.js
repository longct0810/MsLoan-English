const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('v0.22 skill analytics uses student_skill_events',()=>{
  const repo=read('src/modules/skills/skill.repository.js');
  const report=read('src/modules/reports/report.repository.js');
  const portal=read('src/modules/portal/portal.repository.js');
  assert.match(repo,/getStudentSkillSummary/);
  assert.match(repo,/FROM student_skill_events e/);
  assert.doesNotMatch(repo,/LEFT JOIN student_skills ss/);
  assert.match(report,/getStudentSkillSummary/);
  assert.match(portal,/getStudentSkillSummary/);
});
test('v0.22 student profile route and google assessment skill override',()=>{
  const routes=read('src/modules/students/student.routes.js');
  const view=read('src/views/students/index.ejs');
  const dsRoutes=read('src/modules/data-sources/google-sheet.routes.js');
  const dsRepo=read('src/modules/data-sources/google-sheet.repository.js');
  assert.match(routes,/web\.get\('\/students\/:id'/);
  assert.match(view,/href="\/students\/<%= s\.id %>/);
  assert.match(dsRoutes,/assessments\/:assessmentId\/skill/);
  assert.match(dsRepo,/manualSetAssessmentSkill/);
  assert.match(dsRepo,/skill_source'='MANUAL/);
  assert.match(dsRepo,/__AUTO__/);
});
test('v0.22 migration adds skill analytics index',()=>{
  const migration=read('db/neon_upgrade_v0.22.0.sql');
  assert.match(migration,/idx_student_skill_events_student_class_skill_date/);
});
