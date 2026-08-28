'use strict';

const crypto = require('node:crypto');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  const input = String(text ?? '').replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }

  return rows;
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDate(value) {
  const raw = String(value ?? '').trim();
  const match = raw.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function extractHeaderMax(fieldName) {
  const raw = String(fieldName ?? '');
  const matches = [...raw.matchAll(/\/\s*(\d+(?:[.,]\d+)?)/g)];
  if (!matches.length) return null;
  const value = Number(matches[matches.length - 1][1].replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseFraction(value) {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^(-?\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/);
  if (!match) return null;
  const score = Number(match[1].replace(',', '.'));
  const max = Number(match[2].replace(',', '.'));
  if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0) return null;
  return { score, max };
}

function parseNumber(value) {
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) return null;
  const result = Number(raw);
  return Number.isFinite(result) ? result : null;
}

function detectSkill(fieldName) {
  const n = normalizeText(fieldName);
  if (/\b(reading|doc hieu)\b/.test(n)) return 'READING';
  if (/\b(listening|nghe)\b/.test(n)) return 'LISTENING';
  if (/\b(writing|viet)\b/.test(n)) return 'WRITING';
  if (/\b(speaking|noi)\b/.test(n)) return 'SPEAKING';
  if (/\b(pronunciation|phat am)\b/.test(n)) return 'PRONUNCIATION';
  if (/\b(vocabulary|tu vung|vocab)\b/.test(n)) return 'VOCABULARY';
  if (/\b(grammar|tenses?|thi dong tu|ngu phap)\b/.test(n)) return 'GRAMMAR';
  return null;
}

function normalizeAttendance(value) {
  const n = normalizeText(value);
  if (['1', 'x', 'co', 'co mat', 'present'].includes(n)) return 'PRESENT';
  if (['0', 'vang', 'nghi', 'absent'].includes(n)) return 'ABSENT';
  if (n.includes('co phep') || n.includes('vang phep')) return 'ABSENT_EXCUSED';
  if (n.includes('muon') || n.includes('late')) return 'LATE';
  if (n.includes('online')) return 'ONLINE';
  return null;
}

function normalizeHomework(value) {
  const n = normalizeText(value);
  if (!n) return null;
  if (['ht', 'hoan thanh', 'done', 'completed'].includes(n) || n.includes('hoan thanh')) return 'COMPLETED';
  if (n.includes('chua') || n.includes('not done') || n.includes('unfinished')) return 'NOT_COMPLETED';
  if (n.includes('nghi')) return 'ABSENT';
  if (n.includes('quen')) return 'FORGOT';
  if (n.includes('moi nhan')) return 'RECEIVED';
  if (n.includes('da chua')) return 'REVIEWED';
  return null;
}

function classifyObservation(fieldName, rawValue) {
  const field = normalizeText(fieldName);
  const raw = String(rawValue ?? '').trim();
  const rawNorm = normalizeText(raw);
  const skillCode = detectSkill(fieldName);
  const fraction = parseFraction(raw);
  const headerMax = extractHeaderMax(fieldName);
  const numeric = parseNumber(raw);

  if (field.includes('diem danh') || field.includes('attendance')) {
    return {
      type: 'ATTENDANCE',
      normalizedStatus: normalizeAttendance(raw),
      skillCode: null,
      numericValue: numeric,
      maxValue: 1,
    };
  }

  if (
    field.includes('cambridge') ||
    field.includes('cefr') ||
    (/\blevel\b/.test(field) && /^(a1|a2|b1|b2|c1|c2)$/.test(rawNorm)) ||
    /^(a1|a2|b1|b2|c1|c2)$/.test(rawNorm)
  ) {
    return {
      type: 'LEVEL',
      normalizedStatus: raw.toUpperCase(),
      skillCode: null,
      numericValue: null,
      maxValue: null,
    };
  }

  const scoreishField = /\b(test|kiem tra|reading|listening|grammar|tenses?|vocabulary|tu vung|score|diem|pet|unit)\b/.test(field);

  if (fraction) {
    return {
      type: 'SCORE',
      normalizedStatus: null,
      skillCode,
      numericValue: fraction.score,
      maxValue: fraction.max,
    };
  }

  if (numeric !== null && headerMax !== null) {
    return {
      type: 'SCORE',
      normalizedStatus: null,
      skillCode,
      numericValue: numeric,
      maxValue: headerMax,
    };
  }

  if (numeric !== null && scoreishField && numeric >= 0 && numeric <= 10) {
    return {
      type: 'SCORE',
      normalizedStatus: null,
      skillCode,
      numericValue: numeric,
      maxValue: 10,
    };
  }

  const homeworkStatus = normalizeHomework(raw);
  if (/\b(btvn|bai tap|homework|workbook|sach)\b/.test(field) && homeworkStatus) {
    return {
      type: 'HOMEWORK_STATUS',
      normalizedStatus: homeworkStatus,
      skillCode,
      numericValue: null,
      maxValue: null,
    };
  }

  if (/\b(luu y|ghi chu|nhan xet|chu y|can chu y|note)\b/.test(field)) {
    return {
      type: 'NOTE',
      normalizedStatus: null,
      skillCode,
      numericValue: null,
      maxValue: null,
    };
  }

  return {
    type: 'TEXT',
    normalizedStatus: homeworkStatus,
    skillCode,
    numericValue: numeric,
    maxValue: headerMax,
  };
}

function findStudentHeaderRow(rows) {
  const max = Math.min(rows.length, 80);
  for (let i = 0; i < max; i += 1) {
    const normalized = rows[i].map(normalizeText);
    const stt = normalized.findIndex((v) => v === 'stt' || v === 'tt');
    const name = normalized.findIndex((v) => v === 'ho va ten' || v === 'ho ten' || v.includes('ho va ten'));
    if (name >= 0 && (stt >= 0 || normalized.length > 2)) {
      const hasDatesOnAnchor = rows[i].some((value, index) => index > name && Boolean(extractDate(value)));
      return {
        rowIndex: i,
        sttIndex: stt,
        nameIndex: name,
        dateRowIndex: hasDatesOnAnchor ? i : Math.max(0, i - 1),
        fieldRowIndex: hasDatesOnAnchor ? Math.min(i + 1, rows.length - 1) : i,
        dataStartIndex: hasDatesOnAnchor ? i + 2 : i + 1,
      };
    }
  }
  throw new Error('Không tìm thấy dòng tiêu đề có cột "Họ và Tên" trong Google Sheet.');
}

function buildColumnMeta(rows, headerInfo) {
  const fieldRow = rows[headerInfo.fieldRowIndex] || [];
  const dateRow = rows[headerInfo.dateRowIndex] || [];
  const maxColumns = Math.max(fieldRow.length, dateRow.length);
  const columns = [];

  const explicitDates = [];
  for (let i = 0; i < maxColumns; i += 1) {
    const detected = extractDate(dateRow[i]);
    if (detected) explicitDates.push({ index: i, date: detected });
  }

  let currentDate = null;
  let currentDateIndex = -1;
  let nextExplicitPointer = 0;

  for (let i = 0; i < maxColumns; i += 1) {
    while (nextExplicitPointer < explicitDates.length && explicitDates[nextExplicitPointer].index < i) {
      nextExplicitPointer += 1;
    }

    const detected = extractDate(dateRow[i]);
    if (detected) {
      currentDate = detected;
      currentDateIndex = i;
      if (nextExplicitPointer < explicitDates.length && explicitDates[nextExplicitPointer].index === i) {
        nextExplicitPointer += 1;
      }
    }

    if (i === headerInfo.sttIndex || i === headerInfo.nameIndex) continue;

    const fieldName = String(fieldRow[i] ?? '').trim();
    const dateHeader = String(dateRow[i] ?? '').trim();

    let effectiveFieldName = fieldName;
    if (!effectiveFieldName && headerInfo.fieldRowIndex === headerInfo.dateRowIndex) {
      effectiveFieldName = dateHeader.replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/g, '').trim();
    }

    if (!effectiveFieldName && !currentDate) continue;

    const hasNextExplicitDate = explicitDates.some((entry) => entry.index > currentDateIndex);
    let dateConfidence = null;
    if (currentDate) {
      if (i === currentDateIndex) dateConfidence = 'EXPLICIT';
      else if (hasNextExplicitDate) dateConfidence = 'BOUNDED_FORWARD_FILL';
      else dateConfidence = 'UNBOUNDED_LAST_GROUP';
    }

    columns.push({
      index: i,
      observedOn: currentDate,
      fieldName: effectiveFieldName || `Cột ${i + 1}`,
      rawDateHeader: dateHeader,
      dateConfidence,
    });
  }

  return columns;
}

function buildExternalStudentKey(name, stt, occurrence = 1) {
  const normalized = normalizeName(name);
  const stable = normalized || `row-${String(stt ?? '').trim() || 'unknown'}`;
  return occurrence > 1 ? `name:${stable}#${occurrence}` : `name:${stable}`;
}

function makeObservationKey(sourceId, externalStudentKey, observedOn, columnIndex, fieldName) {
  const input = [sourceId, externalStudentKey, observedOn || '', columnIndex, normalizeText(fieldName)].join('|');
  return crypto.createHash('sha256').update(input).digest('hex');
}

function parseTeacherTrackingSheet(csvText, { sourceId = 0 } = {}) {
  const rows = parseCsv(csvText);
  const headerInfo = findStudentHeaderRow(rows);
  const columns = buildColumnMeta(rows, headerInfo);
  const students = [];
  const occurrences = new Map();

  for (let r = headerInfo.dataStartIndex; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const name = String(row[headerInfo.nameIndex] ?? '').trim();
    if (!name) continue;

    const normalized = normalizeName(name);
    if (!normalized || ['ho va ten', 'ho ten'].includes(normalized)) continue;

    const stt = headerInfo.sttIndex >= 0 ? String(row[headerInfo.sttIndex] ?? '').trim() : '';
    const occurrence = (occurrences.get(normalized) || 0) + 1;
    occurrences.set(normalized, occurrence);
    const externalStudentKey = buildExternalStudentKey(name, stt, occurrence);

    const observations = [];
    for (const col of columns) {
      const rawValue = String(row[col.index] ?? '').trim();
      if (!rawValue) continue;

      const classification = classifyObservation(col.fieldName, rawValue);
      observations.push({
        externalStudentKey,
        observedOn: col.observedOn,
        sourceColumnIndex: col.index,
        fieldName: col.fieldName,
        rawDateHeader: col.rawDateHeader,
        dateConfidence: col.dateConfidence,
        rawValue,
        observationType: classification.type,
        skillCode: classification.skillCode,
        numericValue: classification.numericValue,
        maxValue: classification.maxValue,
        normalizedStatus: classification.normalizedStatus,
        observationKey: makeObservationKey(
          sourceId,
          externalStudentKey,
          col.observedOn,
          col.index,
          col.fieldName,
        ),
      });
    }

    if (observations.length === 0 && !stt) continue;
    students.push({
      externalStudentKey,
      externalStudentName: name,
      externalRowHint: stt || String(r + 1),
      sourceRowIndex: r,
      observations,
    });
  }

  return {
    rowsRead: rows.length,
    headerRowIndex: headerInfo.rowIndex,
    columns,
    students,
  };
}

module.exports = {
  parseCsv,
  normalizeText,
  normalizeName,
  extractDate,
  extractHeaderMax,
  parseFraction,
  parseNumber,
  detectSkill,
  normalizeAttendance,
  normalizeHomework,
  classifyObservation,
  findStudentHeaderRow,
  buildColumnMeta,
  makeObservationKey,
  parseTeacherTrackingSheet,
};
