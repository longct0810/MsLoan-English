#!/usr/bin/env node
'use strict';

const { Pool } = require('pg');
const { createGoogleSheetRepository } = require('../src/modules/data-sources/google-sheet.repository');
const { createGoogleSheetService } = require('../src/modules/data-sources/google-sheet.service');

function argsToObject(argv) {
  const result = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) result[name] = true;
    else { result[name] = next; i += 1; }
  }
  return result;
}

async function main() {
  const args = argsToObject(process.argv);
  if (!process.env.DATABASE_URL) throw new Error('Thiếu DATABASE_URL.');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: String(process.env.PGSSL || 'true').toLowerCase() === 'false' ? false : { rejectUnauthorized: false },
  });

  try {
    const repository = createGoogleSheetRepository(pool);
    const service = createGoogleSheetService({ pool, repository, logger: console });
    let sourceId = Number(args['source-id'] || 0);

    if (!sourceId) {
      const teacherId = Number(args['teacher-id']);
      const classId = Number(args['class-id']);
      const url = args.url;
      if (!teacherId || !classId || !url) {
        throw new Error('Cần --source-id hoặc bộ --teacher-id --class-id --url.');
      }
      const source = await service.createSource({
        teacherId,
        classId,
        name: args.name || 'Theo dõi lớp - Google Sheets',
        url,
        intervalMinutes: Number(args.interval || 15),
        importFromDate: args.from || null,
      });
      sourceId = source.id;
      console.log(`Registered source_id=${sourceId}`);
    }

    const result = await service.syncSource(sourceId, { triggerType: 'CLI', force: Boolean(args.force) });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
