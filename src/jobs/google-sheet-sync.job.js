'use strict';

function startGoogleSheetSyncJob(service, { logger = console } = {}) {
  const enabled = String(process.env.GOOGLE_SHEET_SYNC_ENABLED ?? 'true').toLowerCase() !== 'false';
  if (!enabled) {
    logger.info?.('[GOOGLE_SHEET_SYNC] Scheduler disabled by GOOGLE_SHEET_SYNC_ENABLED=false');
    return () => {};
  }

  // Wake-up cadence. Each source has its own sync_interval_minutes in DB;
  // listDueSources() decides whether a source is actually due.
  const tickMs = Math.max(Number(process.env.GOOGLE_SHEET_SYNC_TICK_MS || 60_000), 60_000);
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    try {
      const results = await service.syncDueSources();
      if (results.length) logger.info?.('[GOOGLE_SHEET_SYNC] tick', results);
    } catch (error) {
      logger.error?.('[GOOGLE_SHEET_SYNC] scheduler error', error);
    } finally {
      running = false;
    }
  }

  const timer = setInterval(tick, tickMs);
  timer.unref?.();
  setTimeout(tick, 3000).unref?.();

  return () => clearInterval(timer);
}

module.exports = { startGoogleSheetSyncJob };
