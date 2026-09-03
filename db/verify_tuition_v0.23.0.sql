-- v0.23.0 verification - run after migration/deploy.

-- 1) Default rates by class.
SELECT c.id,c.name,g.grade_no,
       p.unit_price,p.billed_statuses,p.is_active
  FROM classes c
  JOIN grades g ON g.id=c.grade_id
  LEFT JOIN tuition_plans p ON p.class_id=c.id AND p.is_active=TRUE
 WHERE c.deleted_at IS NULL AND g.grade_no IN (6,7,8,9)
 ORDER BY g.grade_no,c.name;

-- 2) Attendance rows available for billing and their source.
SELECT c.name,cs.session_date,a.status,
       COALESCE(a.source_type,'MANUAL') AS source_type,
       COUNT(*)::int AS students
  FROM session_attendance a
  JOIN class_sessions cs ON cs.id=a.session_id
  JOIN classes c ON c.id=cs.class_id
 GROUP BY c.name,cs.session_date,a.status,COALESCE(a.source_type,'MANUAL')
 ORDER BY cs.session_date DESC,c.name,a.status;

-- 3) Generated tuition cycles/invoices.
SELECT cy.id AS cycle_id,c.name,cy.period_month,cy.status,
       COUNT(i.id)::int AS invoices,
       COALESCE(SUM(i.final_amount),0) AS total_amount,
       COALESCE(SUM(i.amount_paid),0) AS amount_paid
  FROM tuition_cycles cy
  JOIN classes c ON c.id=cy.class_id
  LEFT JOIN tuition_invoices i ON i.cycle_id=cy.id AND i.status<>'CANCELLED'
 GROUP BY cy.id,c.name
 ORDER BY cy.period_month DESC,cy.id DESC;

-- 4) Detail for one student (change the name when needed).
SELECT s.full_name,c.name AS class_name,cy.period_month,
       i.public_code,i.billable_sessions,i.unit_price,i.final_amount,
       i.amount_paid,i.status,i.due_date
  FROM tuition_invoices i
  JOIN students s ON s.id=i.student_id
  JOIN classes c ON c.id=i.class_id
  JOIN tuition_cycles cy ON cy.id=i.cycle_id
 WHERE lower(trim(s.full_name))=lower(trim('Cao Gia Linh'))
 ORDER BY cy.period_month DESC;
