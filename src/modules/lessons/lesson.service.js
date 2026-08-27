const repo = require('./lesson.repository');
const classService = require('../classes/class.service');

async function owned(lesson, userId, isAdmin) {
  return Boolean(lesson && (isAdmin || await classService.getClassDetail(lesson.classId, userId, false)));
}

function cleanText(value) {
  return String(value || '').trim();
}

function normalizeResourceUrl(value) {
  const text = cleanText(value);
  if (!text) return '';
  try {
    const parsed = new URL(text);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('INVALID_RESOURCE_URL');
    return parsed.toString();
  } catch (error) {
    throw new Error('INVALID_RESOURCE_URL');
  }
}

async function list(filters, userId, isAdmin = false) {
  const classes = isAdmin ? await repo.findClasses() : await classService.getClasses(userId, false);
  const allowed = new Set(classes.map((item) => Number(item.id)));
  const lessons = (await repo.findAll(filters)).filter((lesson) => isAdmin || allowed.has(Number(lesson.classId)));
  return { lessons, classes };
}

async function detail(id, userId, isAdmin = false) {
  const lesson = await repo.findById(id);
  return await owned(lesson, userId, isAdmin) ? lesson : null;
}

async function newForm(userId, isAdmin = false) {
  return { classes: isAdmin ? await repo.findClasses() : await classService.getClasses(userId, false) };
}

async function create(body, userId, isAdmin = false) {
  const title = cleanText(body.title);
  const classId = Number(body.classId);
  if (!title) throw new Error('TITLE_REQUIRED');
  if (!Number.isInteger(classId) || classId <= 0) throw new Error('CLASS_REQUIRED');
  if (!await classService.getClassDetail(classId, userId, isAdmin)) throw new Error('CLASS_NOT_FOUND');
  return repo.create({
    classId,
    title,
    unitName: cleanText(body.unitName),
    summary: cleanText(body.summary),
    content: cleanText(body.content),
    sortOrder: Number(body.sortOrder || 0),
  }, userId);
}


async function editForm(id, userId, isAdmin = false) {
  const [lesson, classes] = await Promise.all([detail(id, userId, isAdmin), newForm(userId, isAdmin).then((data) => data.classes)]);
  return { lesson, classes };
}

async function update(id, body, userId, isAdmin = false) {
  const existing = await detail(id, userId, isAdmin);
  if (!existing) throw new Error('LESSON_NOT_FOUND');
  const title = cleanText(body.title);
  const classId = Number(existing.classId);
  if (!title) throw new Error('TITLE_REQUIRED');
  return repo.update(id, {
    classId,
    title,
    unitName: cleanText(body.unitName),
    summary: cleanText(body.summary),
    content: cleanText(body.content),
    sortOrder: Number(body.sortOrder || 0),
  });
}

async function publish(id, userId, isAdmin = false) {
  if (!await detail(id, userId, isAdmin)) throw new Error('LESSON_NOT_FOUND');
  return repo.publish(id);
}

async function addMaterial(id, body, userId, isAdmin = false) {
  const title = cleanText(body.title);
  if (!title) throw new Error('MATERIAL_TITLE_REQUIRED');
  if (!await detail(id, userId, isAdmin)) throw new Error('LESSON_NOT_FOUND');
  return repo.addMaterial(id, {
    title,
    type: cleanText(body.type) || 'LINK',
    description: cleanText(body.description),
    resourceUrl: normalizeResourceUrl(body.resourceUrl),
    status: body.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
  }, userId);
}

module.exports = { list, detail, newForm, create, editForm, update, publish, addMaterial };
