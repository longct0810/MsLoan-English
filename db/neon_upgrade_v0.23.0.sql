-- English Classroom v0.23.0
-- Tuition Billing & QR Payment
-- Baseline: v0.22.0

BEGIN;

CREATE TABLE IF NOT EXISTS teacher_payment_settings (
  teacher_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bank_name VARCHAR(120) NOT NULL,
  bank_code VARCHAR(30),
  bank_bin VARCHAR(20) NOT NULL,
  bank_account_no VARCHAR(60) NOT NULL,
  bank_account_name VARCHAR(200) NOT NULL,
  qr_provider VARCHAR(30) NOT NULL DEFAULT 'VIETQR_IMAGE',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT teacher_payment_settings_provider_check
    CHECK (qr_provider IN ('VIETQR_IMAGE'))
);

CREATE TABLE IF NOT EXISTS tuition_plans (
  id BIGSERIAL PRIMARY KEY,
  teacher_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  billing_type VARCHAR(30) NOT NULL DEFAULT 'PER_SESSION',
  unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  billed_statuses JSONB NOT NULL DEFAULT '["PRESENT","LATE","ONLINE"]'::jsonb,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tuition_plans_billing_type_check
    CHECK (billing_type IN ('PER_SESSION')),
  CONSTRAINT tuition_plans_effective_window_check
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tuition_plans_active_class
  ON tuition_plans(class_id)
  WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_tuition_plans_teacher_class
  ON tuition_plans(teacher_id, class_id, is_active);

CREATE TABLE IF NOT EXISTS tuition_cycles (
  id BIGSERIAL PRIMARY KEY,
  teacher_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  plan_id BIGINT NOT NULL REFERENCES tuition_plans(id) ON DELETE RESTRICT,
  period_month DATE NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  plan_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tuition_cycles_status_check
    CHECK (status IN ('DRAFT','SENT','CLOSED','CANCELLED')),
  CONSTRAINT tuition_cycles_date_check
    CHECK (to_date >= from_date),
  UNIQUE(class_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_tuition_cycles_teacher_month
  ON tuition_cycles(teacher_id, period_month DESC, class_id);

CREATE TABLE IF NOT EXISTS tuition_invoices (
  id BIGSERIAL PRIMARY KEY,
  cycle_id BIGINT NOT NULL REFERENCES tuition_cycles(id) ON DELETE CASCADE,
  teacher_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  plan_id BIGINT NOT NULL REFERENCES tuition_plans(id) ON DELETE RESTRICT,
  public_code VARCHAR(60) UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  due_date DATE NOT NULL,
  attendance_present INTEGER NOT NULL DEFAULT 0 CHECK (attendance_present >= 0),
  attendance_late INTEGER NOT NULL DEFAULT 0 CHECK (attendance_late >= 0),
  attendance_online INTEGER NOT NULL DEFAULT 0 CHECK (attendance_online >= 0),
  attendance_absent INTEGER NOT NULL DEFAULT 0 CHECK (attendance_absent >= 0),
  attendance_excused INTEGER NOT NULL DEFAULT 0 CHECK (attendance_excused >= 0),
  billable_sessions INTEGER NOT NULL DEFAULT 0 CHECK (billable_sessions >= 0),
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  other_fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (other_fee_amount >= 0),
  final_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (final_amount >= 0),
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  note TEXT,
  plan_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculation_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  payment_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tuition_invoices_status_check
    CHECK (status IN ('DRAFT','UNPAID','PARTIAL','PAID','CANCELLED')),
  CONSTRAINT tuition_invoices_amount_check
    CHECK (final_amount = GREATEST(subtotal - discount_amount + other_fee_amount, 0)),
  UNIQUE(cycle_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_tuition_invoices_student_status
  ON tuition_invoices(student_id, status, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_tuition_invoices_teacher_cycle
  ON tuition_invoices(teacher_id, cycle_id, status);

CREATE TABLE IF NOT EXISTS tuition_invoice_items (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES tuition_invoices(id) ON DELETE CASCADE,
  item_type VARCHAR(30) NOT NULL,
  description VARCHAR(300) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tuition_invoice_items_type_check
    CHECK (item_type IN ('TUITION','DISCOUNT','OTHER'))
);
CREATE INDEX IF NOT EXISTS idx_tuition_invoice_items_invoice
  ON tuition_invoice_items(invoice_id, id);

CREATE TABLE IF NOT EXISTS tuition_payments (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES tuition_invoices(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(30) NOT NULL DEFAULT 'BANK_TRANSFER',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reference_no VARCHAR(150),
  note TEXT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tuition_payments_method_check
    CHECK (payment_method IN ('BANK_TRANSFER','CASH','OTHER'))
);
CREATE INDEX IF NOT EXISTS idx_tuition_payments_invoice_paid
  ON tuition_payments(invoice_id, paid_at DESC);

-- Seed the rates confirmed for the current teaching model.
-- Grade 6 represents the "lớp 5 lên 6" group.
INSERT INTO tuition_plans(
  teacher_id,class_id,name,billing_type,unit_price,billed_statuses,effective_from,is_active
)
SELECT c.teacher_id,
       c.id,
       CASE
         WHEN g.grade_no = 6 THEN 'Học phí lớp 5 lên 6'
         ELSE 'Học phí lớp ' || g.grade_no::text
       END,
       'PER_SESSION',
       CASE WHEN g.grade_no = 6 THEN 150000 ELSE 220000 END,
       '["PRESENT","LATE","ONLINE"]'::jsonb,
       CURRENT_DATE,
       TRUE
  FROM classes c
  JOIN grades g ON g.id = c.grade_id
 WHERE c.teacher_id IS NOT NULL
   AND c.deleted_at IS NULL
   AND c.status = 'ACTIVE'
   AND g.grade_no IN (6,7,8,9)
   AND NOT EXISTS (
       SELECT 1 FROM tuition_plans p
        WHERE p.class_id = c.id AND p.is_active = TRUE
   );

COMMIT;
