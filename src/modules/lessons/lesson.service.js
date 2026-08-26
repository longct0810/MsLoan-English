const repo = require('./lesson.repository');

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

async function list(filters) {
  return Promise.all([repo.findAll(filters), repo.findClasses()]).then(([lessons, classes]) => ({ lessons, classes }));
}

async function detail(id) {
  return repo.findById(id);
}

async function newForm() {
  return { classes: await repo.findClasses() };
}

async function create(body, userId) {
  const title = cleanText(body.title);
  const classId = Number(body.classId);
  if (!title) throw new Error('TITLE_REQUIRED');
  if (!Number.isInteger(classId) || classId <= 0) throw new Error('CLASS_REQUIRED');
  return repo.create({
    classId,
    title,
    unitName: cleanText(body.unitName),
    summary: cleanText(body.summary),
    content: cleanText(body.content),
    sortOrder: Number(body.sortOrder || 0),
  }, userId);
}


async function editForm(id) {
  const [lesson, classes] = await Promise.all([repo.findById(id), repo.findClasses()]);
  return { lesson, classes };
}

async function update(id, body) {
  const existing = await repo.findById(id);
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

async function publish(id) {
  return repo.publish(id);
}

async function addMaterial(id, body, userId) {
  const title = cleanText(body.title);
  if (!title) throw new Error('MATERIAL_TITLE_REQUIRED');
  return repo.addMaterial(id, {
    title,
    type: cleanText(body.type) || 'LINK',
    description: cleanText(body.description),
    resourceUrl: normalizeResourceUrl(body.resourceUrl),
    status: body.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
  }, userId);
}

module.exports = { list, detail, newForm, create, editForm, update, publish, addMaterial };
