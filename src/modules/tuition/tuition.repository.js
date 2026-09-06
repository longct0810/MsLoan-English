const env = require('../../config/env');
const pool = require('../../config/db');
const { buildTransferCode } = require('../../shared/account-identifiers');

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function getDashboard(teacherId) {
  if (env.demo.enabled) return { paymentSettings: null, classes: [], cycles: [] };

  const [settingsResult, classesResult, cyclesResult] = await Promise.all([
    pool.query(`
      SELECT teacher_id AS "teacherId",bank_name AS "bankName",bank_code AS "bankCode",
             bank_bin AS "bankBin",bank_account_no AS "bankAccountNo",
             bank_account_name AS "bankAccountName",qr_provider AS "qrProvider",
             is_active AS "isActive",updated_at AS "updatedAt"
        FROM teacher_payment_settings
       WHERE teacher_id=$1
    `, [teacherId]),
    pool.query(`
      SELECT c.id,c.name,g.grade_no AS grade,c.school_year AS "schoolYear",c.schedule_text AS schedule,
             p.id AS "planId",p.name AS "planName",p.billing_type AS "billingType",
             p.unit_price::float AS "unitPrice",p.billed_statuses AS "billedStatuses",
             p.effective_from AS "effectiveFrom",p.is_active AS "planActive",
             CASE WHEN g.grade_no=6 THEN 150000 WHEN g.grade_no IN (7,8,9) THEN 220000 ELSE NULL END::float AS "suggestedUnitPrice"
        FROM classes c
        JOIN grades g ON g.id=c.grade_id
        LEFT JOIN tuition_plans p ON p.class_id=c.id AND p.teacher_id=$1 AND p.is_active=TRUE
       WHERE c.teacher_id=$1 AND c.deleted_at IS NULL AND c.status='ACTIVE'
       ORDER BY g.grade_no,c.name
    `, [teacherId]),
    pool.query(`
      SELECT cy.id,cy.class_id AS "classId",c.name AS "className",cy.period_month AS "periodMonth",
             cy.from_date AS "fromDate",cy.to_date AS "toDate",cy.due_date AS "dueDate",cy.status,
             cy.generated_at AS "generatedAt",cy.sent_at AS "sentAt",
             COUNT(i.id)::int AS "invoiceCount",
             COALESCE(SUM(i.final_amount),0)::float AS "totalAmount",
             COALESCE(SUM(i.amount_paid),0)::float AS "paidAmount"
        FROM tuition_cycles cy
        JOIN classes c ON c.id=cy.class_id
        LEFT JOIN tuition_invoices i ON i.cycle_id=cy.id AND i.status<>'CANCELLED'
       WHERE cy.teacher_id=$1
       GROUP BY cy.id,c.id
       ORDER BY cy.period_month DESC,cy.id DESC
       LIMIT 24
    `, [teacherId]),
  ]);

  return {
    paymentSettings: settingsResult.rows[0] || null,
    classes: classesResult.rows,
    cycles: cyclesResult.rows,
  };
}

async function upsertPaymentSettings(teacherId, data) {
  const { rows } = await pool.query(`
    INSERT INTO teacher_payment_settings(
      teacher_id,bank_name,bank_code,bank_bin,bank_account_no,bank_account_name,qr_provider,is_active
    ) VALUES($1,$2,NULLIF($3,''),$4,$5,$6,'VIETQR_IMAGE',TRUE)
    ON CONFLICT(teacher_id) DO UPDATE SET
      bank_name=EXCLUDED.bank_name,bank_code=EXCLUDED.bank_code,bank_bin=EXCLUDED.bank_bin,
      bank_account_no=EXCLUDED.bank_account_no,bank_account_name=EXCLUDED.bank_account_name,
      qr_provider='VIETQR_IMAGE',is_active=TRUE,updated_at=NOW()
    RETURNING teacher_id AS "teacherId",bank_name AS "bankName",bank_code AS "bankCode",
              bank_bin AS "bankBin",bank_account_no AS "bankAccountNo",bank_account_name AS "bankAccountName"
  `, [teacherId, data.bankName, data.bankCode || '', data.bankBin, data.bankAccountNo, data.bankAccountName]);
  return rows[0];
}

async function upsertPlan(teacherId, classId, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const owned = await client.query(`
      SELECT c.id,g.grade_no AS grade FROM classes c JOIN grades g ON g.id=c.grade_id
       WHERE c.id=$1 AND c.teacher_id=$2 AND c.deleted_at IS NULL AND c.status='ACTIVE' FOR UPDATE
    `, [classId, teacherId]);
    if (!owned.rows[0]) throw new Error('CLASS_NOT_FOUND');

    const current = await client.query(`SELECT id FROM tuition_plans WHERE class_id=$1 AND is_active=TRUE FOR UPDATE`, [classId]);
    let row;
    if (current.rows[0]) {
      const updated = await client.query(`
        UPDATE tuition_plans SET name=$1,unit_price=$2,billed_statuses=$3::jsonb,updated_at=NOW()
         WHERE id=$4 AND teacher_id=$5
        RETURNING *
      `, [data.name, data.unitPrice, JSON.stringify(data.billedStatuses), current.rows[0].id, teacherId]);
      row = updated.rows[0];
    } else {
      const inserted = await client.query(`
        INSERT INTO tuition_plans(teacher_id,class_id,name,billing_type,unit_price,billed_statuses,effective_from,is_active)
        VALUES($1,$2,$3,'PER_SESSION',$4,$5::jsonb,CURRENT_DATE,TRUE)
        RETURNING *
      `, [teacherId, classId, data.name, data.unitPrice, JSON.stringify(data.billedStatuses)]);
      row = inserted.rows[0];
    }
    await client.query('COMMIT');
    return row;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

async function getClassPlanForUpdate(client, teacherId, classId) {
  const { rows } = await client.query(`
    SELECT p.*,c.name AS class_name,g.grade_no AS grade
      FROM tuition_plans p
      JOIN classes c ON c.id=p.class_id
      JOIN grades g ON g.id=c.grade_id
     WHERE p.class_id=$1 AND p.teacher_id=$2 AND p.is_active=TRUE
       AND c.teacher_id=$2 AND c.deleted_at IS NULL AND c.status='ACTIVE'
     LIMIT 1 FOR UPDATE OF p
  `, [classId, teacherId]);
  return rows[0] || null;
}

async function generateCycle({ teacherId, classId, periodMonth, fromDate, toDate, dueDate, createdBy }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const plan = await getClassPlanForUpdate(client, teacherId, classId);
    if (!plan) throw new Error('TUITION_PLAN_NOT_FOUND');

    const existing = await client.query(`
      SELECT * FROM tuition_cycles WHERE class_id=$1 AND period_month=$2 FOR UPDATE
    `, [classId, periodMonth]);
    let cycleId;
    if (existing.rows[0]) {
      if (existing.rows[0].teacher_id !== Number(teacherId) && String(existing.rows[0].teacher_id) !== String(teacherId)) throw new Error('CYCLE_NOT_FOUND');
      if (existing.rows[0].status !== 'DRAFT') throw new Error('CYCLE_ALREADY_SENT');
      cycleId = existing.rows[0].id;
      await client.query(`DELETE FROM tuition_invoices WHERE cycle_id=$1`, [cycleId]);
      await client.query(`
        UPDATE tuition_cycles SET plan_id=$1,from_date=$2,to_date=$3,due_date=$4,
               plan_snapshot=$5::jsonb,generated_at=NOW(),updated_at=NOW()
         WHERE id=$6
      `, [plan.id, fromDate, toDate, dueDate, JSON.stringify({
        id: plan.id, name: plan.name, billingType: plan.billing_type,
        unitPrice: num(plan.unit_price), billedStatuses: plan.billed_statuses,
      }), cycleId]);
    } else {
      const inserted = await client.query(`
        INSERT INTO tuition_cycles(
          teacher_id,class_id,plan_id,period_month,from_date,to_date,due_date,status,plan_snapshot,created_by
        ) VALUES($1,$2,$3,$4,$5,$6,$7,'DRAFT',$8::jsonb,$9)
        RETURNING id
      `, [teacherId, classId, plan.id, periodMonth, fromDate, toDate, dueDate, JSON.stringify({
        id: plan.id, name: plan.name, billingType: plan.billing_type,
        unitPrice: num(plan.unit_price), billedStatuses: plan.billed_statuses,
      }), createdBy]);
      cycleId = inserted.rows[0].id;
    }

    const students = await client.query(`
      SELECT s.id,s.full_name AS "fullName",s.student_code AS "studentCode"
        FROM class_students cs
        JOIN students s ON s.id=cs.student_id
       WHERE cs.class_id=$1
         AND cs.joined_at <= $3
         AND (cs.left_at IS NULL OR cs.left_at >= $2)
         AND s.deleted_at IS NULL
         AND s.status='ACTIVE'
       ORDER BY s.full_name
    `, [classId, fromDate, toDate]);

    const attendance = await client.query(`
      SELECT a.student_id AS "studentId",cs.id AS "sessionId",cs.session_date AS "sessionDate",
             cs.topic,a.status,a.source_type AS "sourceType",a.source_ref AS "sourceRef"
        FROM class_sessions cs
        JOIN session_attendance a ON a.session_id=cs.id
       WHERE cs.class_id=$1 AND cs.session_date BETWEEN $2 AND $3 AND cs.status<>'CANCELLED'
       ORDER BY cs.session_date,cs.id
    `, [classId, fromDate, toDate]);

    const byStudent = new Map();
    attendance.rows.forEach((row) => {
      const key = Number(row.studentId);
      if (!byStudent.has(key)) byStudent.set(key, []);
      byStudent.get(key).push(row);
    });

    const billedStatuses = Array.isArray(plan.billed_statuses) ? plan.billed_statuses : ['PRESENT', 'LATE', 'ONLINE'];
    const billedSet = new Set(billedStatuses.map(String));
    const unitPrice = num(plan.unit_price);

    for (const student of students.rows) {
      const rows = byStudent.get(Number(student.id)) || [];
      const count = (status) => rows.filter((row) => row.status === status).length;
      const billable = rows.filter((row) => billedSet.has(row.status)).length;
      const subtotal = Math.round(billable * unitPrice);
      const calcSnapshot = {
        fromDate, toDate, billedStatuses,
        attendance: rows.map((row) => ({
          sessionId: row.sessionId, sessionDate: row.sessionDate, topic: row.topic,
          status: row.status, sourceType: row.sourceType, sourceRef: row.sourceRef,
        })),
      };
      const inserted = await client.query(`
        INSERT INTO tuition_invoices(
          cycle_id,teacher_id,class_id,student_id,plan_id,status,due_date,
          attendance_present,attendance_late,attendance_online,attendance_absent,attendance_excused,
          billable_sessions,unit_price,subtotal,discount_amount,other_fee_amount,final_amount,amount_paid,
          plan_snapshot,calculation_snapshot
        ) VALUES(
          $1,$2,$3,$4,$5,'DRAFT',$6,$7,$8,$9,$10,$11,$12,$13,$14,0,0,$14,0,$15::jsonb,$16::jsonb
        ) RETURNING id
      `, [
        cycleId, teacherId, classId, student.id, plan.id, dueDate,
        count('PRESENT'), count('LATE'), count('ONLINE'), count('ABSENT'), count('ABSENT_EXCUSED'),
        billable, unitPrice, subtotal,
        JSON.stringify({ id: plan.id, name: plan.name, billingType: plan.billing_type, unitPrice, billedStatuses }),
        JSON.stringify(calcSnapshot),
      ]);
      const invoiceId = inserted.rows[0].id;
      const publicCode = `HP-${String(periodMonth).slice(0, 7).replace('-', '')}-${String(invoiceId).padStart(6, '0')}`;
      const transferCode = buildTransferCode(periodMonth, student.studentCode);
      if (!transferCode) throw new Error('STUDENT_CODE_REQUIRED');
      await client.query(`UPDATE tuition_invoices SET public_code=$1,transfer_code=$2 WHERE id=$3`, [publicCode, transferCode, invoiceId]);
      await client.query(`
        INSERT INTO tuition_invoice_items(invoice_id,item_type,description,quantity,unit_price,amount,meta)
        VALUES($1,'TUITION',$2,$3,$4,$5,$6::jsonb)
      `, [invoiceId, `Học phí ${plan.class_name} (${fromDate} - ${toDate})`, billable, unitPrice, subtotal,
        JSON.stringify({ billedStatuses })]);
    }

    await client.query('COMMIT');
    return cycleId;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

async function getCycle(teacherId, cycleId) {
  const cycleResult = await pool.query(`
    SELECT cy.id,cy.teacher_id AS "teacherId",cy.class_id AS "classId",c.name AS "className",
           g.grade_no AS grade,cy.period_month AS "periodMonth",cy.from_date AS "fromDate",cy.to_date AS "toDate",
           cy.due_date AS "dueDate",cy.status,cy.generated_at AS "generatedAt",cy.sent_at AS "sentAt",
           cy.plan_snapshot AS "planSnapshot"
      FROM tuition_cycles cy
      JOIN classes c ON c.id=cy.class_id
      JOIN grades g ON g.id=c.grade_id
     WHERE cy.id=$1 AND cy.teacher_id=$2 AND c.teacher_id=$2
     LIMIT 1
  `, [cycleId, teacherId]);
  if (!cycleResult.rows[0]) return null;

  const invoiceResult = await pool.query(`
    SELECT i.id,i.public_code AS "publicCode",i.transfer_code AS "transferCode",i.student_id AS "studentId",s.student_code AS "studentCode",s.full_name AS "studentName",
           i.status,i.due_date AS "dueDate",i.attendance_present AS "presentCount",i.attendance_late AS "lateCount",
           i.attendance_online AS "onlineCount",i.attendance_absent AS "absentCount",i.attendance_excused AS "excusedCount",
           i.billable_sessions AS "billableSessions",i.unit_price::float AS "unitPrice",
           i.final_amount::float AS "finalAmount",i.amount_paid::float AS "amountPaid"
      FROM tuition_invoices i JOIN students s ON s.id=i.student_id
     WHERE i.cycle_id=$1 AND i.teacher_id=$2
     ORDER BY s.full_name
  `, [cycleId, teacherId]);

  return { ...cycleResult.rows[0], invoices: invoiceResult.rows };
}

async function sendCycle(teacherId, cycleId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const settingsResult = await client.query(`SELECT * FROM teacher_payment_settings WHERE teacher_id=$1 AND is_active=TRUE FOR UPDATE`, [teacherId]);
    const settings = settingsResult.rows[0];
    if (!settings) throw new Error('PAYMENT_SETTINGS_REQUIRED');

    const cycleResult = await client.query(`
      SELECT cy.* FROM tuition_cycles cy JOIN classes c ON c.id=cy.class_id
       WHERE cy.id=$1 AND cy.teacher_id=$2 AND c.teacher_id=$2 FOR UPDATE OF cy
    `, [cycleId, teacherId]);
    const cycle = cycleResult.rows[0];
    if (!cycle) throw new Error('CYCLE_NOT_FOUND');
    if (cycle.status !== 'DRAFT') throw new Error('CYCLE_ALREADY_SENT');

    await client.query(`
      UPDATE tuition_invoices i
         SET transfer_code = 'HP ' || TO_CHAR(cy.period_month, 'YYYYMM') || ' ' || s.student_code,
             updated_at = NOW()
        FROM tuition_cycles cy, students s
       WHERE i.cycle_id = cy.id
         AND i.student_id = s.id
         AND i.cycle_id = $1
         AND i.teacher_id = $2
         AND (i.transfer_code IS NULL OR BTRIM(i.transfer_code) = '')
         AND s.student_code IS NOT NULL
    `, [cycleId, teacherId]);

    const paymentSnapshot = {
      bankName: settings.bank_name,
      bankCode: settings.bank_code,
      bankBin: settings.bank_bin,
      bankAccountNo: settings.bank_account_no,
      bankAccountName: settings.bank_account_name,
      qrProvider: settings.qr_provider,
    };

    await client.query(`
      UPDATE tuition_invoices
         SET status=CASE WHEN final_amount=0 THEN 'PAID' ELSE 'UNPAID' END,
             payment_snapshot=$1::jsonb,sent_at=NOW(),
             paid_at=CASE WHEN final_amount=0 THEN NOW() ELSE NULL END,updated_at=NOW()
       WHERE cycle_id=$2 AND teacher_id=$3 AND status='DRAFT'
    `, [JSON.stringify(paymentSnapshot), cycleId, teacherId]);
    await client.query(`UPDATE tuition_cycles SET status='SENT',sent_at=NOW(),updated_at=NOW() WHERE id=$1`, [cycleId]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally { client.release(); }
}

async function updateInvoiceAdjustments(teacherId, invoiceId, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`
      SELECT i.* FROM tuition_invoices i JOIN classes c ON c.id=i.class_id
       WHERE i.id=$1 AND i.teacher_id=$2 AND c.teacher_id=$2 FOR UPDATE OF i
    `, [invoiceId, teacherId]);
    const invoice = result.rows[0];
    if (!invoice) throw new Error('INVOICE_NOT_FOUND');
    if (invoice.status !== 'DRAFT') throw new Error('INVOICE_ALREADY_SENT');
    const discount = Math.max(0, num(data.discountAmount));
    const other = Math.max(0, num(data.otherFeeAmount));
    const subtotal = num(invoice.subtotal);
    const finalAmount = Math.max(0, subtotal - discount + other);
    await client.query(`
      UPDATE tuition_invoices SET discount_amount=$1,other_fee_amount=$2,final_amount=$3,note=$4,updated_at=NOW()
       WHERE id=$5
    `, [discount, other, finalAmount, data.note || null, invoiceId]);
    await client.query(`DELETE FROM tuition_invoice_items WHERE invoice_id=$1 AND item_type IN ('DISCOUNT','OTHER')`, [invoiceId]);
    if (discount > 0) await client.query(`INSERT INTO tuition_invoice_items(invoice_id,item_type,description,quantity,unit_price,amount) VALUES($1,'DISCOUNT','Giảm học phí',1,$2,$3)`, [invoiceId, -discount, -discount]);
    if (other > 0) await client.query(`INSERT INTO tuition_invoice_items(invoice_id,item_type,description,quantity,unit_price,amount) VALUES($1,'OTHER','Phụ thu',1,$2,$2)`, [invoiceId, other]);
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally { client.release(); }
}

async function getTeacherInvoice(teacherId, invoiceId) {
  const { rows } = await pool.query(`
    SELECT i.id,i.public_code AS "publicCode",i.transfer_code AS "transferCode",i.status,i.due_date AS "dueDate",i.student_id AS "studentId",
           s.student_code AS "studentCode",s.full_name AS "studentName",c.name AS "className",cy.period_month AS "periodMonth",
           cy.from_date AS "fromDate",cy.to_date AS "toDate",i.attendance_present AS "presentCount",
           i.attendance_late AS "lateCount",i.attendance_online AS "onlineCount",i.attendance_absent AS "absentCount",
           i.attendance_excused AS "excusedCount",i.billable_sessions AS "billableSessions",
           i.unit_price::float AS "unitPrice",i.subtotal::float AS subtotal,i.discount_amount::float AS "discountAmount",
           i.other_fee_amount::float AS "otherFeeAmount",i.final_amount::float AS "finalAmount",
           i.amount_paid::float AS "amountPaid",i.note,i.plan_snapshot AS "planSnapshot",
           i.calculation_snapshot AS "calculationSnapshot",i.payment_snapshot AS "paymentSnapshot",
           i.sent_at AS "sentAt",i.paid_at AS "paidAt"
      FROM tuition_invoices i
      JOIN students s ON s.id=i.student_id
      JOIN classes c ON c.id=i.class_id
      JOIN tuition_cycles cy ON cy.id=i.cycle_id
     WHERE i.id=$1 AND i.teacher_id=$2 AND c.teacher_id=$2
     LIMIT 1
  `, [invoiceId, teacherId]);
  if (!rows[0]) return null;
  const [items, payments] = await Promise.all([
    pool.query(`SELECT id,item_type AS "itemType",description,quantity::float AS quantity,unit_price::float AS "unitPrice",amount::float AS amount FROM tuition_invoice_items WHERE invoice_id=$1 ORDER BY id`, [invoiceId]),
    pool.query(`SELECT id,amount::float AS amount,payment_method AS "paymentMethod",paid_at AS "paidAt",reference_no AS "referenceNo",note FROM tuition_payments WHERE invoice_id=$1 ORDER BY paid_at DESC,id DESC`, [invoiceId]),
  ]);
  return { ...rows[0], items: items.rows, payments: payments.rows };
}

async function recordPayment(teacherId, invoiceId, data, createdBy) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      SELECT i.* FROM tuition_invoices i JOIN classes c ON c.id=i.class_id
       WHERE i.id=$1 AND i.teacher_id=$2 AND c.teacher_id=$2 FOR UPDATE OF i
    `, [invoiceId, teacherId]);
    const invoice = rows[0];
    if (!invoice) throw new Error('INVOICE_NOT_FOUND');
    if (!['UNPAID','PARTIAL'].includes(invoice.status)) throw new Error('INVOICE_NOT_PAYABLE');
    const remaining = Math.max(0, num(invoice.final_amount) - num(invoice.amount_paid));
    const amount = num(data.amount);
    if (!(amount > 0) || amount > remaining) throw new Error('INVALID_PAYMENT_AMOUNT');
    await client.query(`
      INSERT INTO tuition_payments(invoice_id,amount,payment_method,paid_at,reference_no,note,created_by)
      VALUES($1,$2,$3,COALESCE(NULLIF($4,'')::timestamptz,NOW()),NULLIF($5,''),NULLIF($6,''),$7)
    `, [invoiceId, amount, data.paymentMethod, data.paidAt || '', data.referenceNo || '', data.note || '', createdBy]);
    const paidResult = await client.query(`SELECT COALESCE(SUM(amount),0)::numeric AS paid FROM tuition_payments WHERE invoice_id=$1`, [invoiceId]);
    const paid = num(paidResult.rows[0].paid);
    const status = paid >= num(invoice.final_amount) ? 'PAID' : 'PARTIAL';
    await client.query(`
      UPDATE tuition_invoices SET amount_paid=$1,status=$2,paid_at=CASE WHEN $2='PAID' THEN NOW() ELSE NULL END,updated_at=NOW()
       WHERE id=$3
    `, [paid, status, invoiceId]);
    await client.query('COMMIT');
    return status;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally { client.release(); }
}

async function getChildren(parentUserId) {
  if (env.demo.enabled) return [];
  const { rows } = await pool.query(`
    SELECT s.id,s.full_name AS "fullName",s.school,s.school_class AS "schoolClass"
      FROM parent_students ps JOIN students s ON s.id=ps.student_id
     WHERE ps.parent_user_id=$1 AND s.deleted_at IS NULL AND s.status='ACTIVE'
     ORDER BY s.full_name
  `, [parentUserId]);
  return rows;
}

async function getParentInvoices(parentUserId, studentId) {
  if (env.demo.enabled) return [];
  const { rows } = await pool.query(`
    SELECT i.id,i.public_code AS "publicCode",i.transfer_code AS "transferCode",i.status,i.due_date AS "dueDate",i.final_amount::float AS "finalAmount",
           i.amount_paid::float AS "amountPaid",cy.period_month AS "periodMonth",c.name AS "className",i.sent_at AS "sentAt"
      FROM tuition_invoices i
      JOIN tuition_cycles cy ON cy.id=i.cycle_id
      JOIN classes c ON c.id=i.class_id
      JOIN parent_students ps ON ps.student_id=i.student_id AND ps.parent_user_id=$1
     WHERE i.student_id=$2 AND i.status NOT IN ('DRAFT','CANCELLED')
     ORDER BY cy.period_month DESC,i.id DESC
  `, [parentUserId, studentId]);
  return rows;
}

async function getParentInvoice(parentUserId, invoiceId) {
  if (env.demo.enabled) return null;
  const { rows } = await pool.query(`
    SELECT i.id,i.public_code AS "publicCode",i.transfer_code AS "transferCode",i.status,i.due_date AS "dueDate",i.student_id AS "studentId",
           s.student_code AS "studentCode",s.full_name AS "studentName",c.name AS "className",cy.period_month AS "periodMonth",
           cy.from_date AS "fromDate",cy.to_date AS "toDate",i.attendance_present AS "presentCount",
           i.attendance_late AS "lateCount",i.attendance_online AS "onlineCount",i.attendance_absent AS "absentCount",
           i.attendance_excused AS "excusedCount",i.billable_sessions AS "billableSessions",i.unit_price::float AS "unitPrice",
           i.subtotal::float AS subtotal,i.discount_amount::float AS "discountAmount",i.other_fee_amount::float AS "otherFeeAmount",
           i.final_amount::float AS "finalAmount",i.amount_paid::float AS "amountPaid",i.note,
           i.calculation_snapshot AS "calculationSnapshot",i.payment_snapshot AS "paymentSnapshot",
           i.sent_at AS "sentAt",i.paid_at AS "paidAt"
      FROM tuition_invoices i
      JOIN students s ON s.id=i.student_id
      JOIN classes c ON c.id=i.class_id
      JOIN tuition_cycles cy ON cy.id=i.cycle_id
      JOIN parent_students ps ON ps.student_id=i.student_id AND ps.parent_user_id=$1
     WHERE i.id=$2 AND i.status NOT IN ('DRAFT','CANCELLED')
     LIMIT 1
  `, [parentUserId, invoiceId]);
  if (!rows[0]) return null;
  const items = await pool.query(`SELECT item_type AS "itemType",description,quantity::float AS quantity,unit_price::float AS "unitPrice",amount::float AS amount FROM tuition_invoice_items WHERE invoice_id=$1 ORDER BY id`, [invoiceId]);
  return { ...rows[0], items: items.rows };
}

module.exports = {
  getDashboard,
  upsertPaymentSettings,
  upsertPlan,
  generateCycle,
  getCycle,
  sendCycle,
  updateInvoiceAdjustments,
  getTeacherInvoice,
  recordPayment,
  getChildren,
  getParentInvoices,
  getParentInvoice,
};
