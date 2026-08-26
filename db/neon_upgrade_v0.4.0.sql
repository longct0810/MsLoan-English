-- English Classroom MVP v0.4.0
-- Upgrade script for Neon PostgreSQL from v0.3.x.
-- Safe design: no DROP TABLE, no DELETE.

BEGIN;

CREATE TABLE IF NOT EXISTS lessons (
  id BIGSERIAL PRIMARY KEY,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title VARCHAR(250) NOT NULL,
  unit_name VARCHAR(150),
  summary TEXT,
  content TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE materials ADD COLUMN IF NOT EXISTS lesson_id BIGINT REFERENCES lessons(id) ON DELETE SET NULL;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS resource_url TEXT;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE materials ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS lesson_id BIGINT REFERENCES lessons(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS max_score NUMERIC(6,2) NOT NULL DEFAULT 10;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS submission_text TEXT;
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS teacher_feedback TEXT;
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE student_scores ADD COLUMN IF NOT EXISTS assignment_id BIGINT REFERENCES assignments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_class_status ON lessons(class_id, status, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_materials_lesson ON materials(lesson_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_lesson ON assignments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student ON assignment_submissions(student_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_scores_assignment
  ON student_scores(student_id, assignment_id)
  WHERE assignment_id IS NOT NULL;

-- Demo lesson seeds. These INSERTs only run if the matching demo class exists.
INSERT INTO lessons (class_id, unit_name, title, summary, content, status, sort_order, created_by, published_at)
SELECT c.id, 'Unit 1', 'My New School',
       'Từ vựng trường học, giới thiệu bản thân và cấu trúc hiện tại đơn.',
       'Ôn từ vựng về trường học, luyện giới thiệu lớp học và thực hành Present Simple.',
       'PUBLISHED', 1,
       (SELECT id FROM users WHERE role='TEACHER' ORDER BY id LIMIT 1), NOW()
  FROM classes c
 WHERE c.name='English 6 - T2/T5'
   AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.class_id=c.id AND l.title='My New School');

INSERT INTO lessons (class_id, unit_name, title, summary, content, status, sort_order, created_by, published_at)
SELECT c.id, 'Unit 2', 'Healthy Living',
       'Past Simple, thói quen tốt và luyện nghe.',
       'Học sinh luyện Past Simple qua tình huống cuối tuần, sau đó nghe đoạn hội thoại về healthy habits.',
       'PUBLISHED', 2,
       (SELECT id FROM users WHERE role='TEACHER' ORDER BY id LIMIT 1), NOW()
  FROM classes c
 WHERE c.name='English 7 - T3/T6'
   AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.class_id=c.id AND l.title='Healthy Living');

INSERT INTO lessons (class_id, unit_name, title, summary, content, status, sort_order, created_by, published_at)
SELECT c.id, 'Unit 1', 'Teen Life',
       'Reading, vocabulary và listening theo chủ đề đời sống tuổi teen.',
       'Đọc hiểu ngắn, mở rộng từ vựng và luyện nghe lấy ý chính.',
       'PUBLISHED', 1,
       (SELECT id FROM users WHERE role='TEACHER' ORDER BY id LIMIT 1), NOW()
  FROM classes c
 WHERE c.name='English 8 - T2/T5'
   AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.class_id=c.id AND l.title='Teen Life');

INSERT INTO lessons (class_id, unit_name, title, summary, content, status, sort_order, created_by)
SELECT c.id, 'Review', 'Grammar Exam Review',
       'Ôn tập ngữ pháp trọng tâm trước bài kiểm tra.',
       'Tổng hợp cấu trúc và lỗi thường gặp.',
       'DRAFT', 99,
       (SELECT id FROM users WHERE role='TEACHER' ORDER BY id LIMIT 1)
  FROM classes c
 WHERE c.name='English 9 - T3/T6'
   AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.class_id=c.id AND l.title='Grammar Exam Review');

-- Link existing demo assignments to lessons without changing user-created records.
UPDATE assignments a
   SET lesson_id = l.id,
       description = COALESCE(NULLIF(a.description,''), 'Luyện Past Simple.'),
       instructions = COALESCE(NULLIF(a.instructions,''), 'Viết 10 câu về hoạt động cuối tuần bằng Past Simple.'),
       published_at = CASE WHEN a.status='PUBLISHED' THEN COALESCE(a.published_at,NOW()) ELSE a.published_at END
  FROM lessons l
 WHERE a.class_id=l.class_id AND a.title='Unit 2 - Grammar' AND l.title='Healthy Living';

UPDATE assignments a
   SET lesson_id = l.id,
       description = COALESCE(NULLIF(a.description,''), 'Bài đọc Teen Life.'),
       instructions = COALESCE(NULLIF(a.instructions,''), 'Đọc đoạn văn và trả lời câu hỏi bằng câu đầy đủ.'),
       published_at = CASE WHEN a.status='PUBLISHED' THEN COALESCE(a.published_at,NOW()) ELSE a.published_at END
  FROM lessons l
 WHERE a.class_id=l.class_id AND a.title='Reading Practice' AND l.title='Teen Life';

UPDATE assignments a
   SET lesson_id=l.id, published_at=CASE WHEN a.status='PUBLISHED' THEN COALESCE(a.published_at,NOW()) ELSE a.published_at END
  FROM lessons l
 WHERE a.class_id=l.class_id AND a.title IN ('Listening - Healthy Living','Quiz Unit 2') AND l.title='Healthy Living';

UPDATE assignments a
   SET lesson_id=l.id, published_at=CASE WHEN a.status='PUBLISHED' THEN COALESCE(a.published_at,NOW()) ELSE a.published_at END
  FROM lessons l
 WHERE a.class_id=l.class_id AND a.title='Vocabulary Review' AND l.title='Teen Life';

UPDATE assignments a
   SET lesson_id=l.id, published_at=CASE WHEN a.status='PUBLISHED' THEN COALESCE(a.published_at,NOW()) ELSE a.published_at END
  FROM lessons l
 WHERE a.class_id=l.class_id AND a.title='Unit 1 - Vocabulary' AND l.title='My New School';

-- Link existing demo materials to their lessons. Existing URL remains unchanged.
UPDATE materials m SET lesson_id=l.id, status=COALESCE(NULLIF(m.status,''),'PUBLISHED')
  FROM lessons l
 WHERE m.class_id=l.class_id AND m.unit_name='Unit 2' AND l.title='Healthy Living';

UPDATE materials m SET lesson_id=l.id, status=COALESCE(NULLIF(m.status,''),'PUBLISHED')
  FROM lessons l
 WHERE m.class_id=l.class_id AND m.unit_name='Unit 1' AND l.title='Teen Life';

COMMIT;

-- Verification
SELECT 'lessons' AS entity, COUNT(*) AS total FROM lessons
UNION ALL SELECT 'materials', COUNT(*) FROM materials
UNION ALL SELECT 'assignments', COUNT(*) FROM assignments
UNION ALL SELECT 'assignment_submissions', COUNT(*) FROM assignment_submissions;
