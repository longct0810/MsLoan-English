-- English Classroom v0.5.0 demo seed for an existing v0.5 schema.
-- Run after neon_upgrade_v0.5.0.sql if you want sample questions/exam.
BEGIN;
-- Demo Question Bank for Grade 7.
INSERT INTO questions(grade_id,lesson_id,created_by,question_type,stem,explanation,difficulty,default_points,status)
SELECT g.id,l.id,u.id,'MULTIPLE_CHOICE','Yesterday, she ___ to the park with her friends.','Past Simple của go là went.','EASY',1,'PUBLISHED'
FROM grades g
LEFT JOIN classes c ON c.grade_id=g.id AND c.name='English 7 - T3/T6'
LEFT JOIN lessons l ON l.class_id=c.id AND l.title='Healthy Living'
CROSS JOIN LATERAL (SELECT id FROM users WHERE role='TEACHER' ORDER BY id LIMIT 1) u
WHERE g.grade_no=7 AND NOT EXISTS(SELECT 1 FROM questions q WHERE q.grade_id=g.id AND q.stem='Yesterday, she ___ to the park with her friends.');

INSERT INTO questions(grade_id,lesson_id,created_by,question_type,stem,explanation,difficulty,default_points,status)
SELECT g.id,l.id,u.id,'TRUE_FALSE','Getting enough sleep is a healthy habit.','Ngủ đủ giấc là một thói quen tốt cho sức khỏe.','EASY',1,'PUBLISHED'
FROM grades g
LEFT JOIN classes c ON c.grade_id=g.id AND c.name='English 7 - T3/T6'
LEFT JOIN lessons l ON l.class_id=c.id AND l.title='Healthy Living'
CROSS JOIN LATERAL (SELECT id FROM users WHERE role='TEACHER' ORDER BY id LIMIT 1) u
WHERE g.grade_no=7 AND NOT EXISTS(SELECT 1 FROM questions q WHERE q.grade_id=g.id AND q.stem='Getting enough sleep is a healthy habit.');

INSERT INTO questions(grade_id,lesson_id,created_by,question_type,stem,correct_answer,explanation,difficulty,default_points,status)
SELECT g.id,l.id,u.id,'FILL_BLANK','Complete the sentence: I ___ my grandparents last weekend. (visit)','visited','Động từ visit ở Past Simple thêm -ed.','MEDIUM',1,'PUBLISHED'
FROM grades g
LEFT JOIN classes c ON c.grade_id=g.id AND c.name='English 7 - T3/T6'
LEFT JOIN lessons l ON l.class_id=c.id AND l.title='Healthy Living'
CROSS JOIN LATERAL (SELECT id FROM users WHERE role='TEACHER' ORDER BY id LIMIT 1) u
WHERE g.grade_no=7 AND NOT EXISTS(SELECT 1 FROM questions q WHERE q.grade_id=g.id AND q.stem='Complete the sentence: I ___ my grandparents last weekend. (visit)');

INSERT INTO questions(grade_id,lesson_id,created_by,question_type,stem,explanation,difficulty,default_points,status)
SELECT g.id,l.id,u.id,'MULTIPLE_CHOICE','Which word is closest in meaning to “healthy”?','Healthy có nghĩa là khỏe mạnh / good for your health.','MEDIUM',1,'PUBLISHED'
FROM grades g
LEFT JOIN classes c ON c.grade_id=g.id AND c.name='English 7 - T3/T6'
LEFT JOIN lessons l ON l.class_id=c.id AND l.title='Healthy Living'
CROSS JOIN LATERAL (SELECT id FROM users WHERE role='TEACHER' ORDER BY id LIMIT 1) u
WHERE g.grade_no=7 AND NOT EXISTS(SELECT 1 FROM questions q WHERE q.grade_id=g.id AND q.stem='Which word is closest in meaning to “healthy”?');

INSERT INTO questions(grade_id,lesson_id,created_by,question_type,stem,correct_answer,explanation,difficulty,default_points,status)
SELECT g.id,l.id,u.id,'FILL_BLANK','Complete: She ___ not go to school yesterday. (do)','did','Phủ định Past Simple dùng did not + V.','HARD',2,'PUBLISHED'
FROM grades g
LEFT JOIN classes c ON c.grade_id=g.id AND c.name='English 7 - T3/T6'
LEFT JOIN lessons l ON l.class_id=c.id AND l.title='Healthy Living'
CROSS JOIN LATERAL (SELECT id FROM users WHERE role='TEACHER' ORDER BY id LIMIT 1) u
WHERE g.grade_no=7 AND NOT EXISTS(SELECT 1 FROM questions q WHERE q.grade_id=g.id AND q.stem='Complete: She ___ not go to school yesterday. (do)');

-- Options are idempotent by (question_id, option_key).
INSERT INTO question_options(question_id,option_key,option_text,is_correct,sort_order)
SELECT q.id,v.k,v.t,v.ok,v.ord FROM questions q CROSS JOIN (VALUES
('A','go',FALSE,1),('B','went',TRUE,2),('C','goes',FALSE,3),('D','going',FALSE,4)) v(k,t,ok,ord)
WHERE q.stem='Yesterday, she ___ to the park with her friends.'
ON CONFLICT(question_id,option_key) DO UPDATE SET option_text=EXCLUDED.option_text,is_correct=EXCLUDED.is_correct,sort_order=EXCLUDED.sort_order;

INSERT INTO question_options(question_id,option_key,option_text,is_correct,sort_order)
SELECT q.id,v.k,v.t,v.ok,v.ord FROM questions q CROSS JOIN (VALUES
('A','True',TRUE,1),('B','False',FALSE,2)) v(k,t,ok,ord)
WHERE q.stem='Getting enough sleep is a healthy habit.'
ON CONFLICT(question_id,option_key) DO UPDATE SET option_text=EXCLUDED.option_text,is_correct=EXCLUDED.is_correct,sort_order=EXCLUDED.sort_order;

INSERT INTO question_options(question_id,option_key,option_text,is_correct,sort_order)
SELECT q.id,v.k,v.t,v.ok,v.ord FROM questions q CROSS JOIN (VALUES
('A','good for your health',TRUE,1),('B','very expensive',FALSE,2),('C','difficult to learn',FALSE,3),('D','very noisy',FALSE,4)) v(k,t,ok,ord)
WHERE q.stem='Which word is closest in meaning to “healthy”?'
ON CONFLICT(question_id,option_key) DO UPDATE SET option_text=EXCLUDED.option_text,is_correct=EXCLUDED.is_correct,sort_order=EXCLUDED.sort_order;

-- Demo online exam.
INSERT INTO exams(class_id,title,description,instructions,duration_minutes,start_at,end_at,max_attempts,show_result,status,created_by,published_at)
SELECT c.id,'Unit 2 Online Quiz','Kiểm tra nhanh Past Simple và Healthy Living.','Đọc kỹ câu hỏi. Hệ thống tự động lưu đáp án.',20,NOW()-INTERVAL '1 day',NOW()+INTERVAL '30 day',2,TRUE,'PUBLISHED',u.id,NOW()
FROM classes c CROSS JOIN LATERAL (SELECT id FROM users WHERE role='TEACHER' ORDER BY id LIMIT 1) u
WHERE c.name='English 7 - T3/T6' AND NOT EXISTS(SELECT 1 FROM exams e WHERE e.class_id=c.id AND e.title='Unit 2 Online Quiz');

INSERT INTO exam_questions(exam_id,question_id,sort_order,points)
SELECT e.id,q.id,ROW_NUMBER() OVER(ORDER BY CASE q.stem
  WHEN 'Yesterday, she ___ to the park with her friends.' THEN 1
  WHEN 'Getting enough sleep is a healthy habit.' THEN 2
  WHEN 'Complete the sentence: I ___ my grandparents last weekend. (visit)' THEN 3
  WHEN 'Which word is closest in meaning to “healthy”?' THEN 4 ELSE 5 END),q.default_points
FROM exams e JOIN classes c ON c.id=e.class_id
JOIN questions q ON q.grade_id=c.grade_id AND q.stem IN (
  'Yesterday, she ___ to the park with her friends.',
  'Getting enough sleep is a healthy habit.',
  'Complete the sentence: I ___ my grandparents last weekend. (visit)',
  'Which word is closest in meaning to “healthy”?',
  'Complete: She ___ not go to school yesterday. (do)')
WHERE e.title='Unit 2 Online Quiz' AND c.name='English 7 - T3/T6'
ON CONFLICT(exam_id,question_id) DO UPDATE SET sort_order=EXCLUDED.sort_order,points=EXCLUDED.points;
COMMIT;

SELECT 'questions' AS entity,COUNT(*) AS total FROM questions
UNION ALL SELECT 'question_options',COUNT(*) FROM question_options
UNION ALL SELECT 'exams',COUNT(*) FROM exams
UNION ALL SELECT 'exam_questions',COUNT(*) FROM exam_questions
UNION ALL SELECT 'exam_attempts',COUNT(*) FROM exam_attempts;
