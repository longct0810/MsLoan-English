'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const VIDEO_MIME_PREFIX = 'video/';
const DEFAULT_TIMEOUT_MS = 120_000;

function isVideoFile(file) {
  return String(file?.mimetype || '').toLowerCase().startsWith(VIDEO_MIME_PREFIX);
}

function runFfmpeg(ffmpegPath, args, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-4000); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => {
      clearTimeout(timer);
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

async function compressVideoFile(file, options = {}) {
  if (!isVideoFile(file) || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) return file;

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'english-classroom-video-'));
  const inputPath = path.join(tempDir, 'input');
  const outputPath = path.join(tempDir, 'compressed.mp4');
  const ffmpegPath = options.ffmpegPath || process.env.FFMPEG_PATH || 'ffmpeg';

  try {
    await fs.writeFile(inputPath, file.buffer);
    const args = [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath,
      '-map', '0:v:0', '-map', '0:a?', '-map_metadata', '0',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outputPath,
    ];
    await (options.runFfmpeg || runFfmpeg)(ffmpegPath, args, options.timeoutMs || DEFAULT_TIMEOUT_MS);
    const compressed = await fs.readFile(outputPath);
    if (compressed.length >= file.buffer.length) return file;

    const extension = path.extname(file.originalname || 'video').toLowerCase();
    const baseName = path.basename(file.originalname || 'video', extension) || 'video';
    return { ...file, originalname: `${baseName}.mp4`, mimetype: 'video/mp4', buffer: compressed, size: compressed.length };
  } catch (error) {
    const wrapped = new Error('VIDEO_COMPRESSION_FAILED');
    wrapped.cause = error;
    throw wrapped;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function compressUploadedFiles(files = [], options = {}) {
  return Promise.all(files.map(file => compressVideoFile(file, options)));
}

module.exports = { isVideoFile, compressVideoFile, compressUploadedFiles };
