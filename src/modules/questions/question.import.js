const ExcelJS = require('exceljs');
const { Readable } = require('stream');

const HEADER_ALIASES = {
  action: ['action', 'hanh_dong', 'hành_động'],
  id: ['id', 'question_id'],
  grade: ['grade', 'khoi', 'khối', 'grade_no'],
  lessonId: ['lesson_id', 'lessonid', 'bai_hoc_id'],
  questionType: ['question_type', 'type', 'loai_cau_hoi'],
  stem: ['stem', 'question', 'noi_dung', 'nội_dung'],
  optionA: ['option_a', 'a'],
  optionB: ['option_b', 'b'],
  optionC: ['option_c', 'c'],
  optionD: ['option_d', 'd'],
  correctOption: ['correct_option', 'dap_an_dung', 'đáp_án_đúng'],
  correctAnswer: ['correct_answer', 'model_answer', 'dap_an_tu_luan', 'đáp_án_tự_luận'],
  explanation: ['explanation', 'giai_thich', 'giải_thích'],
  difficulty: ['difficulty', 'do_kho', 'độ_khó'],
  points: ['points', 'default_points', 'diem', 'điểm'],
  status: ['status', 'trang_thai', 'trạng_thái'],
};

function normalizeHeader(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, '_');
}

function cellValue(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if (value.text != null) return String(value.text);
    if (value.result != null) return String(value.result);
    if (Array.isArray(value.richText)) return value.richText.map((x) => x.text || '').join('');
  }
  return String(value).trim();
}

function canonicalHeader(header) {
  const normalized = normalizeHeader(header);
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.map(normalizeHeader).includes(normalized)) return key;
  }
  return null;
}

async function loadWorkbook(file) {
  const workbook = new ExcelJS.Workbook();
  const name = String(file.originalname || '').toLowerCase();
  if (name.endsWith('.csv') || file.mimetype === 'text/csv') {
    await workbook.csv.read(Readable.from(file.buffer.toString('utf8')));
  } else {
    await workbook.xlsx.load(file.buffer);
  }
  return workbook;
}

async function parseQuestionFile(file, maxRows = 2000) {
  if (!file?.buffer?.length) throw new Error('IMPORT_FILE_REQUIRED');
  const workbook = await loadWorkbook(file);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('IMPORT_EMPTY_FILE');

  const headerMap = new Map();
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const key = canonicalHeader(cellValue(cell.value));
    if (key) headerMap.set(key, col);
  });
  for (const required of ['questionType', 'stem']) {
    if (!headerMap.has(required)) throw new Error(`IMPORT_MISSING_COLUMN:${required}`);
  }

  const rows = [];
  for (let rowNo = 2; rowNo <= sheet.rowCount; rowNo += 1) {
    const row = sheet.getRow(rowNo);
    const get = (key) => headerMap.has(key) ? cellValue(row.getCell(headerMap.get(key)).value) : '';
    const stem = get('stem');
    const id = get('id');
    if (!stem && !id && !get('questionType')) continue;
    rows.push({
      rowNo,
      action: get('action'),
      id,
      grade: get('grade'),
      lessonId: get('lessonId'),
      questionType: get('questionType'),
      stem,
      optionA: get('optionA'), optionB: get('optionB'), optionC: get('optionC'), optionD: get('optionD'),
      correctOption: get('correctOption'),
      correctAnswer: get('correctAnswer'),
      explanation: get('explanation'),
      difficulty: get('difficulty'),
      points: get('points'),
      status: get('status'),
    });
    if (rows.length > maxRows) throw new Error('IMPORT_TOO_MANY_ROWS');
  }
  if (!rows.length) throw new Error('IMPORT_NO_DATA');
  return rows;
}

async function buildTemplateBuffer() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'English Classroom';
  const ws = wb.addWorksheet('Questions');
  const headers = ['action','id','grade','lesson_id','question_type','stem','option_a','option_b','option_c','option_d','correct_option','correct_answer','explanation','difficulty','points','status'];
  ws.addRow(headers);
  ws.addRows([
    ['CREATE','',7,'','MULTIPLE_CHOICE','Yesterday, she ___ to school.','go','went','goes','going','B','','Past Simple of go is went.','EASY',1,'PUBLISHED'],
    ['CREATE','',7,'','TRUE_FALSE','Getting enough sleep is a healthy habit.','','','','','TRUE','','','EASY',1,'PUBLISHED'],
    ['CREATE','',7,'','FILL_BLANK','I ___ my grandparents last weekend. (visit)','','','','','','visited','Accept case-insensitive exact answer.','MEDIUM',1,'DRAFT'],
    ['CREATE','',7,'','ESSAY','Write 80–100 words about your weekend.','','','','','','Use past tense and clear organization.','Teacher grades this answer manually.','MEDIUM',5,'DRAFT'],
    ['UPDATE',1,7,'','MULTIPLE_CHOICE','Updated question text','go','went','goes','going','B','','','MEDIUM',1,'PUBLISHED'],
  ]);
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D6EFD' } };
  ws.columns = [12,10,9,12,22,48,24,24,24,24,16,34,38,14,10,14].map((width) => ({ width }));
  ws.getColumn(6).alignment = { wrapText: true, vertical: 'top' };
  ws.getColumn(12).alignment = { wrapText: true, vertical: 'top' };
  ws.getColumn(13).alignment = { wrapText: true, vertical: 'top' };

  const guide = wb.addWorksheet('Guide');
  guide.addRows([
    ['Column', 'Meaning / allowed values'],
    ['action', 'CREATE hoặc UPDATE. Nếu để trống: có id => UPDATE, không id => CREATE.'],
    ['id', 'Bắt buộc khi UPDATE.'],
    ['grade', '6, 7, 8, 9 hoặc để trống nếu dùng chung.'],
    ['lesson_id', 'ID bài học; có thể để trống.'],
    ['question_type', 'MULTIPLE_CHOICE | TRUE_FALSE | FILL_BLANK | ESSAY'],
    ['correct_option', 'MCQ: A/B/C/D. TRUE_FALSE: TRUE/FALSE hoặc A/B.'],
    ['correct_answer', 'FILL_BLANK: đáp án đúng. ESSAY: đáp án/gợi ý tham khảo, không dùng để tự chấm.'],
    ['difficulty', 'EASY | MEDIUM | HARD'],
    ['points', 'Điểm mặc định > 0.'],
    ['status', 'DRAFT | PUBLISHED'],
    ['', 'Toàn bộ file được kiểm tra trước. Nếu có dòng lỗi, hệ thống không cập nhật bất kỳ dòng nào.'],
  ]);
  guide.getRow(1).font = { bold: true };
  guide.columns = [{ width: 22 }, { width: 85 }];
  guide.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
  return wb.xlsx.writeBuffer();
}

module.exports = { parseQuestionFile, buildTemplateBuffer };
