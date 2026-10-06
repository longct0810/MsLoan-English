'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { isVideoFile, compressVideoFile } = require('../src/shared/video-compression');

test('identifies video uploads by MIME type', () => {
  assert.equal(isVideoFile({ mimetype: 'video/quicktime' }), true);
  assert.equal(isVideoFile({ mimetype: 'audio/mp4' }), false);
  assert.equal(isVideoFile({ mimetype: 'application/pdf' }), false);
});

test('compresses videos to high-quality MP4 and updates stored file metadata', async () => {
  const source = { originalname: 'clip.mov', mimetype: 'video/quicktime', buffer: Buffer.alloc(100, 1), size: 100 };
  let argsUsed;
  const result = await compressVideoFile(source, {
    runFfmpeg: async (_bin, args) => {
      argsUsed = args;
      await fs.writeFile(args.at(-1), Buffer.alloc(45, 2));
    },
  });
  assert.equal(result.originalname, 'clip.mp4');
  assert.equal(result.mimetype, 'video/mp4');
  assert.equal(result.size, 45);
  assert.equal(result.buffer.length, 45);
  assert.equal(argsUsed[argsUsed.indexOf('-crf') + 1], '22');
  assert.equal(argsUsed[argsUsed.indexOf('-preset') + 1], 'medium');
  assert.equal(argsUsed.includes('0:a?'), true);
});

test('keeps the original when transcoding would increase file size', async () => {
  const source = { originalname: 'clip.mp4', mimetype: 'video/mp4', buffer: Buffer.alloc(10), size: 10 };
  const result = await compressVideoFile(source, {
    runFfmpeg: async (_bin, args) => fs.writeFile(args.at(-1), Buffer.alloc(11)),
  });
  assert.equal(result, source);
});

test('does not run ffmpeg for non-video attachments', async () => {
  const source = { originalname: 'work.pdf', mimetype: 'application/pdf', buffer: Buffer.from('pdf') };
  const result = await compressVideoFile(source, { runFfmpeg: () => { throw new Error('must not run'); } });
  assert.equal(result, source);
});
