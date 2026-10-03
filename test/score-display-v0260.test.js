'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreStatusLabel, formatScore, averagePositiveScores } = require('../src/shared/score-display');

test('synced score sentinels have parent-readable labels', () => {
  assert.equal(scoreStatusLabel(-1), 'Quên phiếu bài');
  assert.equal(scoreStatusLabel(-2), 'Chưa hoàn thành');
  assert.equal(formatScore(-1), 'Quên phiếu bài');
  assert.equal(formatScore(-2), 'Chưa hoàn thành');
});

test('score average ignores zero and negative sentinel values', () => {
  assert.equal(averagePositiveScores([
    { score: 8, maxScore: 10 },
    { score: -1, maxScore: 10 },
    { score: -2, maxScore: 10 },
    { score: 0, maxScore: 10 },
    { score: 15, maxScore: 20 },
  ]), 7.75);
  assert.equal(averagePositiveScores([{ score: -1 }, { score: 0 }]), null);
});