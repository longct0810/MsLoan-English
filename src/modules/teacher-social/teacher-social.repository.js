'use strict';

const env = require('../../config/env');
const pool = require('../../config/db');
const demoStore = require('../../shared/demo-store');

async function getLinks(teacherId) {
  if (env.demo.enabled) {
    const links = (demoStore.teacherSocialLinks || []).find((item) => Number(item.teacherId) === Number(teacherId));
    return { facebookUrl: links?.facebookUrl || '', messengerUrl: links?.messengerUrl || '', zaloUrl: links?.zaloUrl || '' };
  }
  const { rows } = await pool.query(`
    SELECT facebook_url AS "facebookUrl", messenger_url AS "messengerUrl", zalo_url AS "zaloUrl"
      FROM teacher_social_links
     WHERE teacher_id=$1
  `, [teacherId]);
  return rows[0] || { facebookUrl: '', messengerUrl: '', zaloUrl: '' };
}

async function saveLinks(teacherId, links) {
  if (env.demo.enabled) {
    demoStore.teacherSocialLinks = demoStore.teacherSocialLinks || [];
    const existing = demoStore.teacherSocialLinks.find((item) => Number(item.teacherId) === Number(teacherId));
    if (existing) Object.assign(existing, links);
    else demoStore.teacherSocialLinks.push({ teacherId: Number(teacherId), ...links });
    return getLinks(teacherId);
  }
  const { rows } = await pool.query(`
    INSERT INTO teacher_social_links(teacher_id,facebook_url,messenger_url,zalo_url,updated_at)
    VALUES($1,NULLIF($2,''),NULLIF($3,''),NULLIF($4,''),NOW())
    ON CONFLICT(teacher_id) DO UPDATE SET
      facebook_url=EXCLUDED.facebook_url,
      messenger_url=EXCLUDED.messenger_url,
      zalo_url=EXCLUDED.zalo_url,
      updated_at=NOW()
    RETURNING facebook_url AS "facebookUrl",messenger_url AS "messengerUrl",zalo_url AS "zaloUrl"
  `, [teacherId, links.facebookUrl, links.messengerUrl, links.zaloUrl]);
  return rows[0];
}

module.exports = { getLinks, saveLinks };