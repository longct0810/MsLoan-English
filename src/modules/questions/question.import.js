const ExcelJS = require('exceljs');
const { Readable } = require('stream');

function normalizeToken(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const HEADER_ALIASES = {
  action: ['action', 'hanh_dong', 'hành động'], // backward compatibility
  id: ['id', 'question_id', 'ma_cau_hoi', 'mã câu hỏi'],
  grade: ['grade', 'khoi', 'khối', 'grade_no'],
  lessonId: ['lesson_id', 'lessonid', 'bai_hoc_id'], // old/advanced template
  questionType: ['question_type', 'type', 'loai_cau_hoi', 'loại câu hỏi'],
  stem: ['stem', 'question', 'noi_dung', 'nội dung', 'noi_dung_cau_hoi', 'nội dung câu hỏi'],
  optionA: ['option_a', 'a', 'dap_an_a', 'đáp án a'],
  optionB: ['option_b', 'b', 'dap_an_b', 'đáp án b'],
  optionC: ['option_c', 'c', 'dap_an_c', 'đáp án c'],
  optionD: ['option_d', 'd', 'dap_an_d', 'đáp án d'],
  answer: ['answer', 'dap_an', 'đáp án', 'dap_an_goi_y', 'đáp án / gợi ý', 'dap_an_dung', 'đáp án đúng'],
  correctOption: ['correct_option'], // backward compatibility
  correctAnswer: ['correct_answer', 'model_answer', 'dap_an_tu_luan', 'đáp án tự luận'],
  explanation: ['explanation', 'giai_thich', 'giải thích', 'ghi_chu', 'ghi chú', 'giai_thich_huong_dan_cham', 'giải thích / hướng dẫn chấm'],
  difficulty: ['difficulty', 'do_kho', 'độ khó'], // old/advanced template
  points: ['points', 'default_points', 'diem', 'điểm'],
  status: ['status', 'trang_thai', 'trạng thái'], // old/advanced template
};

const NORMALIZED_ALIASES = Object.fromEntries(
  Object.entries(HEADER_ALIASES).map(([key, aliases]) => [key, new Set(aliases.map(normalizeToken))])
);

function cellValue(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if (value.text != null) return String(value.text).trim();
    if (value.result != null) return String(value.result).trim();
    if (Array.isArray(value.richText)) return value.richText.map((x) => x.text || '').join('').trim();
  }
  return String(value).trim();
}

function canonicalHeader(header) {
  const normalized = normalizeToken(header);
  for (const [key, aliases] of Object.entries(NORMALIZED_ALIASES)) {
    if (aliases.has(normalized)) return key;
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
    if (key && !headerMap.has(key)) headerMap.set(key, col);
  });

  for (const required of ['questionType', 'stem']) {
    if (!headerMap.has(required)) throw new Error(`IMPORT_MISSING_COLUMN:${required}`);
  }

  const presence = Object.fromEntries(Object.keys(HEADER_ALIASES).map((key) => [key, headerMap.has(key)]));
  const rows = [];
  for (let rowNo = 2; rowNo <= sheet.rowCount; rowNo += 1) {
    const row = sheet.getRow(rowNo);
    const get = (key) => headerMap.has(key) ? cellValue(row.getCell(headerMap.get(key)).value) : '';
    const stem = get('stem');
    const id = get('id');
    if (!stem && !id && !get('questionType')) continue;

    rows.push({
      rowNo,
      _present: presence,
      action: get('action'),
      id,
      grade: get('grade'),
      lessonId: get('lessonId'),
      questionType: get('questionType'),
      stem,
      optionA: get('optionA'), optionB: get('optionB'), optionC: get('optionC'), optionD: get('optionD'),
      answer: get('answer'),
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

  const ws = wb.addWorksheet('Nhap cau hoi');
  const headers = [
    'Mã câu hỏi', 'Khối', 'Loại câu hỏi', 'Nội dung câu hỏi',
    'Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D',
    'Đáp án / Gợi ý', 'Điểm', 'Giải thích / Hướng dẫn chấm',
  ];
  ws.addRow(headers);
  ws.addRow(['', '', '', '', '', '', '', '', '', '', '']);
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: 'A1', to: 'K1' };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D6EFD' } };
  ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  ws.getRow(1).height = 34;
  ws.columns = [15,9,18,48,24,24,24,24,32,9,40].map((width) => ({ width }));
  ['D','E','F','G','H','I','K'].forEach((col) => { ws.getColumn(col).alignment = { wrapText: true, vertical: 'top' }; });
  for (let r = 2; r <= 501; r += 1) {
    ws.getCell(`B${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"6,7,8,9"'] };
    ws.getCell(`C${r}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['"Trắc nghiệm,Đúng/Sai,Điền từ,Tự luận"'] };
    ws.getCell(`J${r}`).dataValidation = { type: 'decimal', operator: 'greaterThan', allowBlank: true, formulae: [0] };
  }

  const examples = wb.addWorksheet('Vi du');
  examples.addRow(headers);
  examples.addRows([
    ['', 7, 'Trắc nghiệm', 'Yesterday, she ___ to school.', 'go', 'went', 'goes', 'going', 'B', 1, 'Past Simple của go là went.'],
    ['', 7, 'Đúng/Sai', 'Getting enough sleep is a healthy habit.', '', '', '', '', 'Đúng', 1, ''],
    ['', 7, 'Điền từ', 'I ___ my grandparents last weekend. (visit)', '', '', '', '', 'visited', 1, 'Không phân biệt chữ hoa/thường.'],
    ['', 7, 'Tự luận', 'Write 80–100 words about your weekend.', '', '', '', '', 'Use Past Simple and clear organization.', 5, 'Giáo viên chấm thủ công.'],
  ]);
  examples.views = [{ state: 'frozen', ySplit: 1 }];
  examples.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  examples.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF198754' } };
  examples.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  examples.getRow(1).height = 34;
  examples.columns = [15,9,18,48,24,24,24,24,32,9,40].map((width) => ({ width }));
  examples.eachRow((row) => { row.alignment = { vertical: 'top', wrapText: true }; });

  const guide = wb.addWorksheet('Huong dan');
  guide.addRows([
    ['HƯỚNG DẪN NHẬP CÂU HỎI', ''],
    ['1', 'Nhập dữ liệu tại sheet “Nhap cau hoi”. Mỗi dòng là một câu hỏi.'],
    ['2', 'Mã câu hỏi: để trống khi thêm mới. Chỉ nhập ID câu hỏi đang có khi muốn cập nhật. Không cần cột CREATE/UPDATE.'],
    ['3', 'Loại câu hỏi chọn: Trắc nghiệm, Đúng/Sai, Điền từ hoặc Tự luận.'],
    ['4', 'Trắc nghiệm: nhập A–D và cột “Đáp án / Gợi ý” ghi A/B/C/D. Đúng/Sai: ghi Đúng hoặc Sai.'],
    ['5', 'Điền từ: “Đáp án / Gợi ý” là đáp án đúng. Tự luận: đây là đáp án/gợi ý để giáo viên tham khảo khi chấm.'],
    ['6', 'Điểm có thể để trống để dùng điểm mặc định của hệ thống. Câu mới import luôn được lưu ở trạng thái Bản nháp để giáo viên kiểm tra trước khi xuất bản.'],
    ['7', 'Nếu file có dòng lỗi, hệ thống sẽ báo rõ số dòng và không ghi bất kỳ câu nào vào database.'],
    ['', 'Sheet “Vi du” chỉ để tham khảo; hệ thống chỉ đọc sheet đầu tiên “Nhap cau hoi”.'],
  ]);
  guide.mergeCells('A1:B1');
  guide.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  guide.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D6EFD' } };
  guide.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  guide.getRow(1).height = 28;
  guide.columns = [{ width: 8 }, { width: 95 }];
  guide.getColumn(2).alignment = { wrapText: true, vertical: 'top' };

  return wb.xlsx.writeBuffer();
}

module.exports = { parseQuestionFile, buildTemplateBuffer };
