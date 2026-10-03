'use strict';

const repo = require('./teacher-social.repository');
const { normalizeSocialLink } = require('../../shared/social-links');

async function getLinks(teacherId) {
  return repo.getLinks(teacherId);
}

async function saveLinks(teacherId, body) {
  const links = {
    facebookUrl: normalizeSocialLink(body.facebookUrl, 'facebookUrl'),
    messengerUrl: normalizeSocialLink(body.messengerUrl, 'messengerUrl'),
    zaloUrl: normalizeSocialLink(body.zaloUrl, 'zaloUrl'),
  };
  return repo.saveLinks(teacherId, links);
}

module.exports = { getLinks, saveLinks };