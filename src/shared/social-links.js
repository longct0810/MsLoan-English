'use strict';

const PLATFORM_HOSTS = {
  facebookUrl: ['facebook.com', 'fb.com'],
  messengerUrl: ['messenger.com', 'm.me'],
  zaloUrl: ['zalo.me', 'zalo.vn', 'zalo.com'],
};

function normalizeSocialLink(value, field) {
  let text = String(value || '').trim();
  if (field === 'zaloUrl') {
    const phone = normalizeZaloPhone(text);
    if (phone) text = `https://zalo.me/${phone}`;
  }
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
  if (field === 'zaloUrl') {
    const target = zaloChatTarget(url.toString());
    if (!target.appUrl) throw new Error('INVALID_ZALO_CHAT_LINK');
    return target.webUrl;
  }
  return url.toString();
}

function normalizeZaloPhone(value) {
  let phone = String(value || '').trim().replace(/[\s().-]/g, '');
  if (/^\+?84\d{9}$/.test(phone)) phone = `0${phone.replace(/^\+?84/, '')}`;
  return /^0[35789]\d{8}$/.test(phone) ? phone : null;
}

function zaloChatTarget(value) {
  let url;
  try { url = new URL(String(value || '')); } catch { return { appUrl: '', webUrl: '' }; }
  if (url.protocol !== 'https:' || !['zalo.me', 'www.zalo.me'].includes(url.hostname) || url.username || url.password) {
    return { appUrl: '', webUrl: '' };
  }
  const phone = normalizeZaloPhone(url.pathname.replace(/^\//, '').replace(/\/$/, ''));
  if (!phone) return { appUrl: '', webUrl: url.toString() };
  return { appUrl: `zalo://conversation?phone=${phone}`, webUrl: `https://zalo.me/${phone}` };
}

module.exports = { normalizeSocialLink, normalizeZaloPhone, zaloChatTarget };