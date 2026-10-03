'use strict';

const service = require('./teacher-social.service');

async function index(req, res, next) {
  try {
    const links = await service.getLinks(req.session.user.id);
    res.render('teacher/social-links', { title: 'Liên hệ phụ huynh', links, saved: req.query.saved === '1', error: null });
  } catch (error) { next(error); }
}

async function save(req, res, next) {
  try {
    await service.saveLinks(req.session.user.id, req.body);
    res.redirect('/teacher/social-links?saved=1');
  } catch (error) {
    if (error.message === 'INVALID_SOCIAL_LINK') {
      return res.status(400).render('teacher/social-links', {
        title: 'Liên hệ phụ huynh',
        links: { facebookUrl: req.body.facebookUrl || '', messengerUrl: req.body.messengerUrl || '', zaloUrl: req.body.zaloUrl || '' },
        saved: false,
        error: 'Vui lòng nhập liên kết HTTPS hợp lệ thuộc đúng mạng xã hội.',
      });
    }
    return next(error);
  }
}

module.exports = { index, save };