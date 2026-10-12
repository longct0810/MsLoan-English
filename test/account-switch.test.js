process.env.DEMO_MODE = 'true';
process.env.SESSION_SECURE = 'false';
require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env.example') });
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
test('teacher logout creates an anonymous session and parent login uses a fresh form', async t => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  async function request(path, body) {
    const res = await fetch(base + path, {redirect:'manual',method:body?'POST':'GET',headers:{Cookie:cookie},body:body?new URLSearchParams(body):undefined});
    if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];
    assert.equal(res.headers.get('cache-control'),'no-store');
    return {status:res.status,location:res.headers.get('location'),body:await res.text()};
  }
  const token = page => page.body.match(/name="_csrf" value="([^"]+)"/)[1];
  const login = await request('/login');
  assert.equal((await request('/login',{username:'teacher',password:'Teacher@123',_csrf:token(login)})).location,'/dashboard');
  const teacherCookie = cookie;
  const teacher = await request('/dashboard');
  assert.equal(teacher.status,200);
  assert.equal((await request('/logout',{_csrf:token(teacher)})).location,'/login');
  assert.notEqual(cookie,teacherCookie);
  assert.equal((await request('/dashboard')).location,'/login');
  const parentForm = await request('/login');
  assert.notEqual(token(parentForm),token(teacher));
  assert.match(parentForm.body,/event.persisted/);
  const parent = await request('/login',{username:'parent',password:'Parent@123',_csrf:token(parentForm)});
  assert.equal(parent.status,302);
  assert.equal(parent.location,'/parent');
  assert.equal((await request('/dashboard')).status,403);
});
