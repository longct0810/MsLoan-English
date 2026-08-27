-- English Classroom v0.6.0 demo seed for an existing v0.6 schema.
-- Adds one ESSAY question and links it to the Grade 7 demo exam.
BEGIN;

INSERT INTO questions(grade_id,lesson_id,created_by,question_type,stem,correct_answer,explanation,difficulty,default_points,status)
SELECT g.id,l.id,u.id,'ESSAY',
       'Write 80–100 words about what you did last weekend.',
       'Use Past Simple, clear organization, and suitable vocabulary.',
       'Chấm theo nội dung, ngữ pháp, từ vựng và bố cục.','MEDIUM',4,'PUBLISHED'
FROM grades g
LEFT JOIN classes c ON c.grade_id=g.id AND c.name='English 7 - T3/T6'
LEFT JOIN lessons l ON l.class_id=c.id AND l.title='Healthy Living'
CROSS JOIN LATERAL (SELECT id FROM users WHERE role='TEACHER' ORDER BY id LIMIT 1) u
WHERE g.grade_no=7
  AND NOT EXISTS(
    SELECT 1 FROM questions q
    WHERE q.grade_id=g.id AND q.stem='Write 80–100 words about what you did last weekend.'
  );

INSERT INTO exam_questions(exam_id,question_id,sort_order,points)
SELECT e.id,q.id,
       COALESCE((SELECT MAX(eq.sort_order)+1 FROM exam_questions eq WHERE eq.exam_id=e.id),1),
       q.default_points
FROM exams e
JOIN classes c ON c.id=e.class_id
JOIN questions q ON q.grade_id=c.grade_id
WHERE e.title='Unit 2 Online Quiz'
  AND c.name='English 7 - T3/T6'
  AND q.stem='Write 80–100 words about what you did last weekend.'
ON CONFLICT(exam_id,question_id) DO UPDATE SET points=EXCLUDED.points;

COMMIT;

SELECT q.id,q.question_type,q.stem,q.default_points,q.status
FROM questions q
WHERE q.stem='Write 80–100 words about what you did last weekend.';
