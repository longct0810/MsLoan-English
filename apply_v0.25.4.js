#!/usr/bin/env node
'use strict';

/**
 * English Classroom v0.25.4
 * Google Sheets Score Deduplication Hotfix
 *
 * Run from repository root:
 *   node apply_v0.25.4.js
 *
 * The script:
 *   - switches Google-Sheets materialized score refs from surrogate DB ids
 *     to stable parser keys;
 *   - removes legacy/materialized duplicate score rows during each sync;
 *   - bumps VERSION/package.json/README to v0.25.4 where present.
 *
 * It intentionally does NOT execute the database migration automatically.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const REPOSITORY_FILE = path.join(
  ROOT,
  'src',
  'modules',
  'data-sources',
  'google-sheet.repository.js',
);

function fail(message) {
  console.error(`\n[FAIL] ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`[v0.25.4] ${message}`);
}

function backup(file) {
  const backupFile = `${file}.v0.25.3.bak`;
  if (!fs.existsSync(backupFile)) {
    fs.copyFileSync(file, backupFile);
    info(`Backup: ${path.relative(ROOT, backupFile)}`);
  }
}

function replaceExactly(text, regex, replacement, label) {
  const matches = text.match(regex);
  if (!matches) fail(`Không tìm thấy đoạn mã cần sửa: ${label}`);
  return text.replace(regex, replacement);
}

function insertBeforeUniqueAnchor(text, anchorRegex, blockFactory, label) {
  const matches = [...text.matchAll(new RegExp(anchorRegex.source, `${anchorRegex.flags.includes('g') ? anchorRegex.flags : `${anchorRegex.flags}g`}`))];
  if (matches.length !== 1) {
    fail(`${label}: cần đúng 1 anchor nhưng tìm thấy ${matches.length}. Source có thể đã khác v0.25.3.`);
  }
  const match = matches[0];
  const indent = match[1] || '';
  const insertion = blockFactory(indent);
  return text.slice(0, match.index) + insertion + text.slice(match.index);
}

if (!fs.existsSync(REPOSITORY_FILE)) {
  fail(`Không tìm thấy ${path.relative(ROOT, REPOSITORY_FILE)}. Hãy chạy script tại root repo MsLoan-English.`);
}

let source = fs.readFileSync(REPOSITORY_FILE, 'utf8');

if (source.includes('v0.25.4 score-dedup: canonical assessment ref')) {
  info('google-sheet.repository.js đã có patch v0.25.4; bỏ qua patch code.');
} else {
  backup(REPOSITORY_FILE);

  // 1) Assessment result: do not key student_scores by surrogate observation/result IDs.
  source = replaceExactly(
    source,
    /const ref = result\.primary_observation_id\s*\?\s*`external-observation:\$\{result\.primary_observation_id\}`\s*:\s*`external-assessment-result:\$\{result\.id\}`;/,
    `// v0.25.4 score-dedup: canonical assessment ref.\n    // external_assessment_key is deterministic for the same Google-Sheet assessment,\n    // while observation/result ids are surrogate DB ids and may be recreated.\n    const ref = \`google-sheet-assessment:\${assessment.external_assessment_key}\`;`,
    'assessment source_ref',
  );

  // 2) Direct score observation: use deterministic observation_key, not observation.id.
  source = replaceExactly(
    source,
    /const ref = `external-observation:\$\{observation\.id\}`;/,
    `// v0.25.4 score-dedup: canonical observation ref.\n    // observation_key is deterministic for the same Sheet cell.\n    const ref = \`google-sheet-observation:\${observation.observation_key}\`;`,
    'observation source_ref',
  );

  // 3) Assessment materialization cleanup.
  source = insertBeforeUniqueAnchor(
    source,
    /(\s*)if \(source\.materializeSkillEvents !== false && assessment\.skill_code\) \{/,
    (indent) => `${indent}// v0.25.4: remove legacy/semantic duplicates for this materialized assessment.\n${indent}// The new canonical row is kept; old external-observation/external-assessment-result\n${indent}// refs and prior rows with the same visible Sheet identity are removed in the same transaction.\n${indent}const keepScoreId = rows[0]?.id || null;\n${indent}if (keepScoreId) {\n${indent}  const legacyRefs = [\n${indent}    result.primary_observation_id ? \`external-observation:\${result.primary_observation_id}\` : null,\n${indent}    \`external-assessment-result:\${result.id}\`,\n${indent}  ].filter(Boolean);\n\n${indent}  await query(db, \`\n${indent}    DELETE FROM student_scores\n${indent}    WHERE student_id=$1\n${indent}      AND source_type='GOOGLE_SHEETS'\n${indent}      AND id<>$2\n${indent}      AND (\n${indent}        source_ref = ANY($3::text[])\n${indent}        OR (\n${indent}          source_payload->>'sourceId'=$4::text\n${indent}          AND class_id IS NOT DISTINCT FROM $5::bigint\n${indent}          AND recorded_at::date IS NOT DISTINCT FROM $6::date\n${indent}          AND title=$7\n${indent}          AND category=$8\n${indent}          AND max_score IS NOT DISTINCT FROM $9::numeric\n${indent}        )\n${indent}      )\n${indent}  \`, [\n${indent}    result.student_id,\n${indent}    keepScoreId,\n${indent}    legacyRefs,\n${indent}    source.id,\n${indent}    source.class_id,\n${indent}    assessment.observed_on,\n${indent}    String(assessment.title || 'Google Sheets').slice(0, 250),\n${indent}    category,\n${indent}    maxScore,\n${indent}  ]);\n${indent}}\n\n`,
    'assessment cleanup anchor',
  );

  // 4) Direct observation materialization cleanup.
  source = insertBeforeUniqueAnchor(
    source,
    /(\s*)if \(source\.materializeSkillEvents !== false && observation\.skill_code && observation\.max_value > 0\) \{/,
    (indent) => `${indent}// v0.25.4: remove legacy/semantic duplicates for this direct score cell.\n${indent}const keepScoreId = rows[0]?.id || null;\n${indent}if (keepScoreId) {\n${indent}  await query(db, \`\n${indent}    DELETE FROM student_scores\n${indent}    WHERE student_id=$1\n${indent}      AND source_type='GOOGLE_SHEETS'\n${indent}      AND id<>$2\n${indent}      AND (\n${indent}        source_ref=$3\n${indent}        OR source_payload->>'observationId'=$4::text\n${indent}        OR (\n${indent}          source_payload->>'sourceId'=$5::text\n${indent}          AND class_id IS NOT DISTINCT FROM $6::bigint\n${indent}          AND recorded_at::date IS NOT DISTINCT FROM $7::date\n${indent}          AND title=$8\n${indent}          AND category=$9\n${indent}          AND max_score IS NOT DISTINCT FROM $10::numeric\n${indent}        )\n${indent}      )\n${indent}  \`, [\n${indent}    observation.student_id,\n${indent}    keepScoreId,\n${indent}    \`external-observation:\${observation.id}\`,\n${indent}    observation.id,\n${indent}    source.id,\n${indent}    source.class_id,\n${indent}    observation.observed_on,\n${indent}    title,\n${indent}    category,\n${indent}    observation.max_value || 10,\n${indent}  ]);\n${indent}}\n\n`,
    'direct score cleanup anchor',
  );

  fs.writeFileSync(REPOSITORY_FILE, source, 'utf8');
  info('Đã patch src/modules/data-sources/google-sheet.repository.js');
}

// Version metadata. These edits are intentionally conservative.
const versionFile = path.join(ROOT, 'VERSION');
if (fs.existsSync(versionFile)) {
  backup(versionFile);
  fs.writeFileSync(versionFile, '0.25.4\n', 'utf8');
  info('VERSION -> 0.25.4');
}

const packageFile = path.join(ROOT, 'package.json');
if (fs.existsSync(packageFile)) {
  let pkgText = fs.readFileSync(packageFile, 'utf8');
  if (/"version"\s*:\s*"0\.25\.3"/.test(pkgText)) {
    backup(packageFile);
    pkgText = pkgText.replace(/"version"\s*:\s*"0\.25\.3"/, '"version": "0.25.4"');
    fs.writeFileSync(packageFile, pkgText, 'utf8');
    info('package.json -> 0.25.4');
  } else if (!/"version"\s*:\s*"0\.25\.4"/.test(pkgText)) {
    info('Cảnh báo: package.json không có version 0.25.3; không tự sửa.');
  }
}

const packageLockFile = path.join(ROOT, 'package-lock.json');
if (fs.existsSync(packageLockFile)) {
  let lockText = fs.readFileSync(packageLockFile, 'utf8');
  if (/"version"\s*:\s*"0\.25\.3"/.test(lockText)) {
    backup(packageLockFile);
    // Replace only project-version literals. A dependency using exactly 0.25.3 is very unlikely;
    // package-lock can also be regenerated with npm install --package-lock-only if desired.
    lockText = lockText.replace(/"version"\s*:\s*"0\.25\.3"/g, '"version": "0.25.4"');
    fs.writeFileSync(packageLockFile, lockText, 'utf8');
    info('package-lock.json -> 0.25.4');
  }
}

const readmeFile = path.join(ROOT, 'README.md');
if (fs.existsSync(readmeFile)) {
  let readme = fs.readFileSync(readmeFile, 'utf8');
  const original = readme;
  readme = readme.replace(/^# English Classroom v0\.25\.3\s*$/m, '# English Classroom v0.25.4');
  readme = readme.replace(/> Phiên bản hiện tại: v0\.25\.\d[^\n]*/m, '> Phiên bản hiện tại: v0.25.4 – Google Sheets Score Deduplication Hotfix.');
  readme = readme.replace(/^Current version:\s*v0\.25\.\d\s*$/m, 'Current version: v0.25.4');
  if (readme !== original) {
    backup(readmeFile);
    fs.writeFileSync(readmeFile, readme, 'utf8');
    info('README.md -> v0.25.4');
  }
}

console.log(`\nHoàn tất patch source v0.25.4.\n\nBước tiếp theo:\n  1. Kiểm tra: git diff\n  2. Chạy migration: sql/upgrade_v0.25.4.sql trên Neon\n  3. Chạy test hiện có: npm test\n  4. Commit/push và để Render deploy\n  5. Bấm Đồng bộ ngay 2-3 lần; mỗi bài phải chỉ còn 1 dòng điểm.\n`);
