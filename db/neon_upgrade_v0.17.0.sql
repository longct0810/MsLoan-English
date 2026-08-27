BEGIN;

-- v0.17.0 - Skill Tracking.
CREATE TABLE IF NOT EXISTS skills (
  code VARCHAR(40) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO skills(code,label,sort_order) VALUES
 ('VOCABULARY','Vocabulary',10),('GRAMMAR','Grammar',20),('READING','Reading',30),
 ('LISTENING','Listening',40),('WRITING','Writing',50),('SPEAKING','Speaking',60),
 ('PRONUNCIATION','Pronunciation',70)
ON CONFLICT(code) DO UPDATE SET label=EXCLUDED.label,sort_order=EXCLUDED.sort_order,is_active=TRUE;

CREATE TABLE IF NOT EXISTS assignment_skills (
  assignment_id BIGINT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  skill_code VARCHAR(40) NOT NULL REFERENCES skills(code),
  weight NUMERIC(6,3) NOT NULL DEFAULT 1 CHECK(weight > 0),
  PRIMARY KEY(assignment_id,skill_code)
);

CREATE TABLE IF NOT EXISTS question_skills (
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  skill_code VARCHAR(40) NOT NULL REFERENCES skills(code),
  weight NUMERIC(6,3) NOT NULL DEFAULT 1 CHECK(weight > 0),
  PRIMARY KEY(question_id,skill_code)
);

CREATE TABLE IF NOT EXISTS student_skill_events (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id BIGINT REFERENCES classes(id) ON DELETE SET NULL,
  skill_code VARCHAR(40) NOT NULL REFERENCES skills(code),
  source_type VARCHAR(20) NOT NULL CHECK(source_type IN ('LEGACY','ASSIGNMENT','EXAM','MANUAL')),
  source_id BIGINT NOT NULL DEFAULT 0,
  score NUMERIC(8,2) NOT NULL,
  max_score NUMERIC(8,2) NOT NULL CHECK(max_score > 0),
  weight NUMERIC(6,3) NOT NULL DEFAULT 1 CHECK(weight > 0),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_skill_event_source
  ON student_skill_events(student_id,skill_code,source_type,source_id);
CREATE INDEX IF NOT EXISTS idx_student_skill_events_student_date
  ON student_skill_events(student_id,skill_code,recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_skill_events_class_date
  ON student_skill_events(class_id,skill_code,recorded_at DESC) WHERE class_id IS NOT NULL;

-- Preserve the old student_skills data as an initial baseline.
INSERT INTO student_skill_events(student_id,class_id,skill_code,source_type,source_id,score,max_score,weight,recorded_at)
SELECT ss.student_id,
       (SELECT MIN(cs.class_id) FROM class_students cs WHERE cs.student_id=ss.student_id AND cs.status='ACTIVE'
         HAVING COUNT(*)=1),
       UPPER(ss.skill),'LEGACY',0,ss.score,10,0.5,NOW()
  FROM student_skills ss
  JOIN skills sk ON sk.code=UPPER(ss.skill)
ON CONFLICT(student_id,skill_code,source_type,source_id) DO NOTHING;

COMMIT;
