'use strict';

const DEFAULT_SYNC_TIMES = ['11:00', '23:00'];

function parseSyncTimes(value = DEFAULT_SYNC_TIMES.join(',')) {
  const times = String(value).split(',').map(part => part.trim()).filter(Boolean);
  if (!times.length) throw new Error('GOOGLE_SHEET_SYNC_TIMES must contain at least one time.');
  const unique = new Set();
  for (const time of times) {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      throw new Error(`Invalid Google Sheets sync time: ${time}`);
    }
    unique.add(time);
  }
  return [...unique].sort();
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}

function localTimeToDate({ year, month, day, hour, minute }, timeZone) {
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let timestamp = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = zonedParts(new Date(timestamp), timeZone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const correction = target - represented;
    timestamp += correction;
    if (correction === 0) break;
  }
  return new Date(timestamp);
}

function getNextRunAt(now = new Date(), timeZone = 'Asia/Ho_Chi_Minh', syncTimes = DEFAULT_SYNC_TIMES) {
  const localNow = zonedParts(now, timeZone);
  const today = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day));
  for (let dayOffset = 0; dayOffset <= 1; dayOffset += 1) {
    const day = new Date(today.getTime() + dayOffset * 86_400_000);
    const dateParts = { year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate() };
    for (const time of syncTimes) {
      const [hour, minute] = time.split(':').map(Number);
      const candidate = localTimeToDate({ ...dateParts, hour, minute }, timeZone);
      if (candidate.getTime() > now.getTime()) return candidate;
    }
  }
  throw new Error('Unable to calculate the next Google Sheets sync time.');
}

function startGoogleSheetSyncJob(service, { logger = console, timeZone = process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh', syncTimes = process.env.GOOGLE_SHEET_SYNC_TIMES || '11:00,23:00' } = {}) {
  const enabled = String(process.env.GOOGLE_SHEET_SYNC_ENABLED ?? 'true').toLowerCase() !== 'false';
  if (!enabled) {
    logger.info?.('[GOOGLE_SHEET_SYNC] Scheduler disabled by GOOGLE_SHEET_SYNC_ENABLED=false');
    return () => {};
  }

  const times = parseSyncTimes(syncTimes);
  let timer = null;
  let running = false;
  let stopped = false;

  async function runAllSources() {
    if (running) {
      logger.warn?.('[GOOGLE_SHEET_SYNC] Scheduled run skipped because the previous run is still active.');
      return;
    }
    running = true;
    try {
      const results = await service.syncAllSources();
      logger.info?.('[GOOGLE_SHEET_SYNC] scheduled run', { timeZone, results });
    } catch (error) {
      logger.error?.('[GOOGLE_SHEET_SYNC] scheduler error', error);
    } finally {
      running = false;
    }
  }

  function scheduleNext() {
    if (stopped) return;
    const now = new Date();
    const next = getNextRunAt(now, timeZone, times);
    const delay = Math.max(1, next.getTime() - now.getTime());
    logger.info?.('[GOOGLE_SHEET_SYNC] next run scheduled', { at: next.toISOString(), timeZone });
    timer = setTimeout(() => {
      timer = null;
      scheduleNext();
      void runAllSources();
    }, delay);
    timer.unref?.();
  }

  scheduleNext();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

module.exports = { DEFAULT_SYNC_TIMES, parseSyncTimes, getNextRunAt, startGoogleSheetSyncJob };
