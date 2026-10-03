'use strict';

const PLATFORM_HOSTS = {
  facebookUrl: ['facebook.com', 'fb.com'],
  messengerUrl: ['messenger.com', 'm.me'],
  zaloUrl: ['zalo.me', 'zalo.vn', 'zalo.com'],
};

function normalizeSocialLink(value, field) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (!PLATFORM_HOSTS[field] || text.length > 500) throw new Error('INVALID_SOCIAL_LINK');
  let url;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    throw new Error('INVALID_SOCIAL_LINK');
  }
  const host = url.hostname.toLowerCase();
  const allowed = PLATFORM_HOSTS[field].some((domain) => host === domain || host.endsWith(`.${domain}`));
  if (url.protocol !== 'https:' || !allowed || url.username || url.password) throw new Error('INVALID_SOCIAL_LINK');
  return url.toString();
}

module.exports = { normalizeSocialLink };