function cleanText(value, max = 120) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function buildVietQrImageUrl({ bankBin, accountNo, accountName, amount, transferContent }) {
  const bin = cleanText(bankBin, 20);
  const account = cleanText(accountNo, 60);
  if (!bin || !account) return null;

  const params = new URLSearchParams();
  const numericAmount = Math.max(0, Math.round(Number(amount) || 0));
  if (numericAmount > 0) params.set('amount', String(numericAmount));
  const info = cleanText(transferContent, 25);
  const name = cleanText(accountName, 200);
  if (info) params.set('addInfo', info);
  if (name) params.set('accountName', name);

  return `https://img.vietqr.io/image/${encodeURIComponent(bin)}-${encodeURIComponent(account)}-compact2.png?${params.toString()}`;
}

module.exports = { buildVietQrImageUrl };
