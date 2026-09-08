-- English Classroom v0.25.2
-- Tuition transfer content: MMYYYY{student_code}
-- Example: 09/2026 + Y6_HS9 => 092026Y6_HS9
--
-- Safety:
-- - Rewrites DRAFT invoices.
-- - Rewrites UNPAID invoices only when amount_paid=0.
-- - Preserves PARTIAL/PAID/CANCELLED history.

BEGIN;

UPDATE tuition_invoices i
   SET transfer_code = TO_CHAR(cy.period_month, 'MMYYYY') || s.student_code,
       updated_at = NOW()
  FROM tuition_cycles cy,
       students s
 WHERE i.cycle_id = cy.id
   AND i.student_id = s.id
   AND s.student_code IS NOT NULL
   AND BTRIM(s.student_code) <> ''
   AND (
        i.status = 'DRAFT'
        OR (i.status = 'UNPAID' AND COALESCE(i.amount_paid, 0) = 0)
       )
   AND i.transfer_code IS DISTINCT FROM
       TO_CHAR(cy.period_month, 'MMYYYY') || s.student_code;

COMMIT;

-- Verify:
-- SELECT i.id, cy.period_month, s.student_code, i.status, i.transfer_code
-- FROM tuition_invoices i
-- JOIN tuition_cycles cy ON cy.id=i.cycle_id
-- JOIN students s ON s.id=i.student_id
-- ORDER BY i.id DESC;
