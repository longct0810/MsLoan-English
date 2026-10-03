'use strict';

const SCORE_STATUS_LABELS = new Map([
  [-1, 'Quên phiếu bài'],
  [-2, 'Chưa hoàn thành'],
]);

function scoreStatusLabel(score) {
  return SCORE_STATUS_LABELS.get(Number(score)) || null;
}

function formatScore(score, maxScore = 10) {
  const statusLabel = scoreStatusLabel(score);
  if (statusLabel) return statusLabel;
  if (score === null || score === undefined || score === '') return '-';
  const max = Number(maxScore);
  return max > 0 && max !== 10 ? `${score}/${maxScore}` : String(score);
}

function averagePositiveScores(scores) {
  const values = scores
    .filter((item) => Number.isFinite(Number(item.score)) && Number(item.score) > 0
      && Number.isFinite(Number(item.maxScore || 10)) && Number(item.maxScore || 10) > 0)
    .map((item) => Number(item.score) / Number(item.maxScore || 10) * 10);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

module.exports = { scoreStatusLabel, formatScore, averagePositiveScores };