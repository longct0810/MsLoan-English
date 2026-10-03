# English Classroom v0.26.0

## Features

- Students can submit text, files, audio, or mixed work, with common classroom document formats supported.
- Parent and student assignment lists put unsubmitted and late work first.
- Synced scores `-1` and `-2` are displayed as “Quên phiếu bài” and “Chưa hoàn thành”; averages include positive scores only.
- Teachers can configure Facebook, Messenger, and Zalo links for the parent portal header.
- Base interface font size is increased by one step.

## Database

Run `sql/upgrade_v0.26.0.sql` before deploying. It creates `teacher_social_links` and recomputes stored averages without zero/negative scores.

## Validation

Run `npm test` before deployment.
