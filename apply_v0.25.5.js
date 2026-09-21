#!/usr/bin/env node
'use strict';

/**
 * English Classroom v0.25.5
 * Google Sheets 3-day automatic sync interval
 *
 * Baseline: v0.25.4
 * Run from repository root:
 *   node apply_v0.25.5.js
 *
 * Notes:
 * - Automatic Google Sheets sync interval becomes 3 days = 4320 minutes.
 * - Manual "Đồng bộ ngay" is not changed.
 * - The scheduler heartbeat/check loop is intentionally NOT slowed down;
 *   due-ness is controlled by external_data_sources.sync_interval_minutes.
 * - Database migration sql/upgrade_v0.25.5.sql must also be executed.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const FROM_VERSION = '0.25.4';
const TO_VERSION = '0.25.5';
const SYNC_MINUTES = 3 * 24 * 60; // 4320
const VALIDATION_MAX_MINUTES = 7 * 24 * 60; // 10080

function info(message) {
  console.log(`[v${TO_VERSION}] ${message}`);
}

function warn(message) {
  console.warn(`[v${TO_VERSION}] Cảnh báo: ${message}`);
}

function backup(file) {
  const backupFile = `${file}.v${FROM_VERSION}.bak`;
  if (!fs.existsSync(backupFile)) {
    fs.copyFileSync(file, backupFile);
  }
}

function writeIfChanged(file, before, after) {
  if (before === after) return false;
  backup(file);
  fs.writeFileSync(file, after, 'utf8');
  info(`Đã cập nhật ${path.relative(ROOT, file)}`);
  return true;
}

function bumpVersionMetadata() {
  const versionFile = path.join(ROOT, 'VERSION');
  if (fs.existsSync(versionFile)) {
    const before = fs.readFileSync(versionFile, 'utf8');
    writeIfChanged(versionFile, before, `${TO_VERSION}\n`);
  }

  const packageFile = path.join(ROOT, 'package.json');
  if (fs.existsSync(packageFile)) {
    const before = fs.readFileSync(packageFile, 'utf8');
    const pkg = JSON.parse(before);
    pkg.version = TO_VERSION;
    const after = `${JSON.stringify(pkg, null, 2)}\n`;
    writeIfChanged(packageFile, before, after);
  }

  const packageLockFile = path.join(ROOT, 'package-lock.json');
  if (fs.existsSync(packageLockFile)) {
    const before = fs.readFileSync(packageLockFile, 'utf8');
    try {
      const lock = JSON.parse(before);
      lock.version = TO_VERSION;
      if (lock.packages && lock.packages['']) {
        lock.packages[''].version = TO_VERSION;
      }
      const after = `${JSON.stringify(lock, null, 2)}\n`;
      writeIfChanged(packageLockFile, before, after);
    } catch (error) {
      warn(`Không parse được package-lock.json: ${error.message}`);
    }
  }

  const readmeFile = path.join(ROOT, 'README.md');
  if (fs.existsSync(readmeFile)) {
    const before = fs.readFileSync(readmeFile, 'utf8');
    let after = before;
    after = after.replace(/v0\.25\.4/g, `v${TO_VERSION}`);
    after = after.replace(/0\.25\.4/g, TO_VERSION);
    writeIfChanged(readmeFile, before, after);
  }
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'coverage', 'dist', 'build'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function patchExplicitSyncIntervalDefaults() {
  const roots = [
    path.join(ROOT, 'src'),
    path.join(ROOT, 'views'),
  ];

  const candidates = roots
    .flatMap((dir) => walk(dir))
    .filter((file) => /\.(js|cjs|mjs|ejs|ts|json)$/i.test(file));

  let changedFiles = 0;
  let matchedFiles = 0;

  for (const file of candidates) {
    const before = fs.readFileSync(file, 'utf8');
    if (!/(sync_interval_minutes|syncIntervalMinutes)/.test(before)) continue;
    matchedFiles += 1;

    const lines = before.split(/(?<=\n)/);
    const patched = lines.map((line) => {
      // Only touch lines that explicitly reference the per-source sync interval.
      // This deliberately avoids changing scheduler polling/heartbeat intervals.
      if (!/(sync_interval_minutes|syncIntervalMinutes)/.test(line)) return line;

      let next = line;

      // Common defaults / object values / form values for the old 15-minute interval.
      next = next.replace(/\b15\b/g, String(SYNC_MINUTES));

      // Existing validation commonly capped the field at one day (1440 minutes),
      // which cannot represent the new 3-day interval.
      next = next.replace(/\b1440\b/g, String(VALIDATION_MAX_MINUTES));

      return next;
    }).join('');

    if (writeIfChanged(file, before, patched)) changedFiles += 1;
  }

  if (matchedFiles === 0) {
    warn('Không tìm thấy sync_interval_minutes/syncIntervalMinutes trong src/views. DB migration vẫn ép lịch 3 ngày/lần.');
  } else {
    info(`Đã rà ${matchedFiles} file có cấu hình sync; thay đổi ${changedFiles} file.`);
  }
}

function writeReleaseMarker() {
  const marker = path.join(ROOT, 'sql', 'upgrade_v0.25.5.sql');
  if (!fs.existsSync(marker)) {
    warn('Chưa thấy sql/upgrade_v0.25.5.sql trong repo. Hãy copy file migration từ patch trước khi deploy.');
  }
}

bumpVersionMetadata();
patchExplicitSyncIntervalDefaults();
writeReleaseMarker();

console.log(`\nHoàn tất source patch v${TO_VERSION}.\n\nThay đổi chính:\n  - Google Sheets auto sync: 3 ngày/lần (${SYNC_MINUTES} phút)\n  - Manual sync: giữ nguyên\n  - Scheduler heartbeat: giữ nguyên\n\nBước tiếp theo:\n  1. git diff\n  2. Chạy sql/upgrade_v0.25.5.sql trên Neon\n  3. npm test\n  4. git add . && git commit -m "chore: v0.25.5 set Google Sheets sync to every 3 days"\n  5. git push origin main\n`);
