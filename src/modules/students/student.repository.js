const bcrypt = require('bcryptjs');
const env = require('../../config/env');
const pool = require('../../config/db');
const demoStore = require('../../shared/demo-store');

function nextId(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.id || item.userId || 0)), 0) + 1;
}

function normalizeIds(values) {
  return [...new Set((values || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

function visibleDemoClasses(actorUserId = null, isAdmin = false) {
  return demoStore.classes.filter((item) => item.status !== 'DELETED'
    && (isAdmin || !actorUserId || Number(item.teacherId) === Number(actorUserId)));
}

function publicStudentDemo(student, actorUserId = null, isAdmin = false) {
  const visibleIds = new Set(visibleDemoClasses(actorUserId, isAdmin).map((item) => Number(item.id)));
  const classItems = demoStore.classes.filter((item) => (student.classIds || []).includes(item.id)
    && item.status !== 'DELETED' && visibleIds.has(Number(item.id)));
  const studentAccount = demoStore.studentAccounts.find((item) => item.studentId === student.id);
  const studentUser = studentAccount ? demoStore.users.find((item) => item.id === studentAccount.userId) : null;
  const parentLink = demoStore.parentStudents.find((item) => item.studentId === student.id);
  const parentUser = parentLink ? demoStore.users.find((item) => item.id === parentLink.parentUserId) : null;
  return {
    ...student,
    classes: classItems.map((item) => item.name),
    classIds: classItems.map((item) => item.id),
    studentEmail: studentUser?.email || student.email || '',
    parentName: parentUser?.fullName || student.parentName || '',
    parentEmail: parentUser?.email || '',
    parentPhone: parentUser?.phone || student.parentPhone || '',
    relationship: parentLink?.relationship || 'Bố/Mẹ',
  };
}

function canAccessDemoStudent(student, actorUserId = null, isAdmin = false) {
  if (!student || student.status === 'DELETED') return false;
  if (isAdmin || !actorUserId) return true;
  const allowed = new Set(visibleDemoClasses(actorUserId, false).map((item) => Number(item.id)));
  return (student.classIds || []).some((classId) => allowed.has(Number(classId)));
}

function assertDemoClasses(classIds, actorUserId = null, isAdmin = false) {
  const requested = normalizeIds(classIds);
  const allowed = new Set(visibleDemoClasses(actorUserId, isAdmin)
    .filter((item) => item.status === 'ACTIVE')
    .map((item) => Number(item.id)));
  if (requested.some((id) => !allowed.has(id))) throw new Error('CLASS_NOT_FOUND');
  return requested;
}

async function assertClassAccess(classIds, actorUserId = null, isAdmin = false, client = pool) {
  const requested = normalizeIds(classIds);
  if (!requested.length) return requested;
  const { rows } = await client.query(`
    SELECT id
      FROM classes
     WHERE id = ANY($1::bigint[])
       AND deleted_at IS NULL
       AND status = 'ACTIVE'
       AND ($2::boolean OR $3::bigint IS NULL OR teacher_id = $3)
  `, [requested, isAdmin, actorUserId]);
  if (rows.length !== requested.length) throw new Error('CLASS_NOT_FOUND');
  return requested;
}

async function findAll({ classId } = {}, actorUserId = null, isAdmin = false) {
  if (env.demo.enabled) {
    const visibleClassIds = new Set(visibleDemoClasses(actorUserId, isAdmin).map((item) => Number(item.id)));
    const selectedClassId = Number(classId || 0);
    if (selectedClassId && !visibleClassIds.has(selectedClassId)) return [];
    return demoStore.students
      .filter((student) => canAccessDemoStudent(student, actorUserId, isAdmin))
      .filter((student) => !selectedClassId || (student.classIds || []).includes(selectedClassId))
      .map((student) => publicStudentDemo(student, actorUserId, isAdmin));
  }

  const selectedClassId = Number(classId) || null;
  const { rows } = await pool.query(`
    SELECT s.id,
           s.full_name AS "fullName",
           s.date_of_birth AS "dateOfBirth",
           s.school,
           s.school_class AS "schoolClass",
           s.phone,
           s.email,
           s.status,
           COALESCE(sp.average_score, 0)::float AS "averageScore",
           COALESCE(sp.attendance_rate, 0)::float AS "attendanceRate",
           ARRAY_REMOVE(ARRAY_AGG(DISTINCT c.name), NULL) AS classes,
           ARRAY_REMOVE(ARRAY_AGG(DISTINCT c.id), NULL) AS "classIds",
           su.email AS "studentEmail",
           pu.full_name AS "parentName",
           pu.email AS "parentEmail",
           COALESCE(pu.phone, s.parent_phone) AS "parentPhone",
           ps.relationship
      FROM students s
      LEFT JOIN class_students cs ON cs.student_id = s.id AND cs.status = 'ACTIVE'
      LEFT JOIN classes c ON c.id = cs.class_id
       AND c.deleted_at IS NULL
       AND ($2::boolean OR $1::bigint IS NULL OR c.teacher_id = $1)
      LEFT JOIN student_progress_summary sp ON sp.student_id = s.id
      LEFT JOIN student_accounts sa ON sa.student_id = s.id
      LEFT JOIN users su ON su.id = sa.user_id
      LEFT JOIN parent_students ps ON ps.student_id = s.id
      LEFT JOIN users pu ON pu.id = ps.parent_user_id
     WHERE s.deleted_at IS NULL
       AND (
         $2::boolean OR $1::bigint IS NULL OR EXISTS (
           SELECT 1
             FROM class_students own_cs
             JOIN classes own_c ON own_c.id = own_cs.class_id
            WHERE own_cs.student_id = s.id
              AND own_cs.status = 'ACTIVE'
              AND own_c.deleted_at IS NULL
              AND own_c.teacher_id = $1
         )
       )
       AND (
         $3::bigint IS NULL OR EXISTS (
           SELECT 1
             FROM class_students filter_cs
             JOIN classes filter_c ON filter_c.id = filter_cs.class_id
            WHERE filter_cs.student_id = s.id
              AND filter_cs.class_id = $3
              AND filter_cs.status = 'ACTIVE'
              AND filter_c.deleted_at IS NULL
              AND ($2::boolean OR $1::bigint IS NULL OR filter_c.teacher_id = $1)
         )
       )
     GROUP BY s.id, sp.average_score, sp.attendance_rate, su.email,
              pu.full_name, pu.email, pu.phone, ps.relationship
     ORDER BY s.full_name
  `, [actorUserId, isAdmin, selectedClassId]);
  return rows;
}

async function findById(id, actorUserId = null, isAdmin = false) {
  if (env.demo.enabled) {
    const student = demoStore.students.find((item) => item.id === Number(id));
    return canAccessDemoStudent(student, actorUserId, isAdmin)
      ? publicStudentDemo(student, actorUserId, isAdmin)
      : null;
  }

  const { rows } = await pool.query(`
    SELECT s.id,
           s.full_name AS "fullName",
           s.date_of_birth AS "dateOfBirth",
           s.school,
           s.school_class AS "schoolClass",
           s.phone,
           s.email,
           s.status,
           ARRAY_REMOVE(ARRAY_AGG(DISTINCT c.id), NULL) AS "classIds",
           su.email AS "studentEmail",
           pu.id AS "parentUserId",
           pu.full_name AS "parentName",
           pu.email AS "parentEmail",
           COALESCE(pu.phone, s.parent_phone) AS "parentPhone",
           ps.relationship
      FROM students s
      LEFT JOIN class_students cs ON cs.student_id = s.id AND cs.status = 'ACTIVE'
      LEFT JOIN classes c ON c.id = cs.class_id
       AND c.deleted_at IS NULL
       AND ($3::boolean OR $2::bigint IS NULL OR c.teacher_id = $2)
      LEFT JOIN student_accounts sa ON sa.student_id = s.id
      LEFT JOIN users su ON su.id = sa.user_id
      LEFT JOIN parent_students ps ON ps.student_id = s.id
      LEFT JOIN users pu ON pu.id = ps.parent_user_id
     WHERE s.id = $1
       AND s.deleted_at IS NULL
       AND (
         $3::boolean OR $2::bigint IS NULL OR EXISTS (
           SELECT 1
             FROM class_students own_cs
             JOIN classes own_c ON own_c.id = own_cs.class_id
            WHERE own_cs.student_id = s.id
              AND own_cs.status = 'ACTIVE'
              AND own_c.deleted_at IS NULL
              AND own_c.teacher_id = $2
         )
       )
     GROUP BY s.id, su.email, pu.id, pu.full_name, pu.email, pu.phone, ps.relationship
  `, [id, actorUserId, isAdmin]);
  return rows[0] || null;
}

async function emailInUse(email, exceptUserId = null, client = pool) {
  const params = [email];
  let extra = '';
  if (exceptUserId) {
    params.push(exceptUserId);
    extra = 'AND id <> $2';
  }
  const { rows } = await client.query(
    `SELECT id, role FROM users WHERE LOWER(email)=LOWER($1) ${extra} LIMIT 1`,
    params,
  );
  return rows[0] || null;
}

async function create(data, actorUserId, isAdmin = false) {
  if (env.demo.enabled) {
    const classIds = assertDemoClasses(data.classIds, actorUserId, isAdmin);
    const studentEmailExists = demoStore.users.find((user) => user.email.toLowerCase() === data.studentEmail.toLowerCase());
    if (studentEmailExists) throw new Error('Email đăng nhập học viên đã được sử dụng.');

    let parentUser = demoStore.users.find((user) => user.email.toLowerCase() === data.parentEmail.toLowerCase());
    if (parentUser && parentUser.role !== 'PARENT') throw new Error('Email phụ huynh đang thuộc một tài khoản không phải phụ huynh.');
    if (!parentUser) {
      if (!data.parentPassword) throw new Error('Cần nhập mật khẩu khi tạo tài khoản phụ huynh mới.');
      parentUser = {
        id: nextId(demoStore.users),
        fullName: data.parentName,
        email: data.parentEmail,
        phone: data.parentPhone,
        passwordHash: bcrypt.hashSync(data.parentPassword, env.security.bcryptRounds),
        role: 'PARENT',
        status: 'ACTIVE',
      };
      demoStore.users.push(parentUser);
    }

    const studentUser = {
      id: nextId(demoStore.users),
      fullName: data.fullName,
      email: data.studentEmail,
      passwordHash: bcrypt.hashSync(data.studentPassword, env.security.bcryptRounds),
      role: 'STUDENT',
      status: 'ACTIVE',
    };
    demoStore.users.push(studentUser);

    const student = {
      id: nextId(demoStore.students),
      fullName: data.fullName,
      dateOfBirth: data.dateOfBirth || null,
      school: data.school || '',
      schoolClass: data.schoolClass || '',
      phone: data.phone || '',
      email: data.studentEmail,
      parentName: data.parentName,
      parentPhone: data.parentPhone,
      status: 'ACTIVE',
      classIds,
      averageScore: 0,
      attendanceRate: 0,
    };
    demoStore.students.push(student);
    demoStore.studentAccounts.push({ userId: studentUser.id, studentId: student.id });
    demoStore.parentStudents.push({ parentUserId: parentUser.id, studentId: student.id, relationship: data.relationship });
    return publicStudentDemo(student, actorUserId, isAdmin);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const classIds = await assertClassAccess(data.classIds, actorUserId, isAdmin, client);
    if (await emailInUse(data.studentEmail, null, client)) throw new Error('Email đăng nhập học viên đã được sử dụng.');

    let parentUserResult = await client.query(
      'SELECT id, role FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1',
      [data.parentEmail],
    );
    let parentUserId;
    if (parentUserResult.rows[0]) {
      if (parentUserResult.rows[0].role !== 'PARENT') throw new Error('Email phụ huynh đang thuộc một tài khoản không phải phụ huynh.');
      parentUserId = parentUserResult.rows[0].id;
      await client.query(
        `UPDATE users SET full_name=$1, phone=$2, status='ACTIVE', updated_at=NOW() WHERE id=$3`,
        [data.parentName, data.parentPhone || null, parentUserId],
      );
    } else {
      if (!data.parentPassword) throw new Error('Cần nhập mật khẩu khi tạo tài khoản phụ huynh mới.');
      const parentHash = await bcrypt.hash(data.parentPassword, env.security.bcryptRounds);
      parentUserResult = await client.query(
        `INSERT INTO users(full_name,email,password_hash,role,status,phone)
         VALUES($1,$2,$3,'PARENT','ACTIVE',$4) RETURNING id`,
        [data.parentName, data.parentEmail, parentHash, data.parentPhone || null],
      );
      parentUserId = parentUserResult.rows[0].id;
    }

    const studentHash = await bcrypt.hash(data.studentPassword, env.security.bcryptRounds);
    const studentUserResult = await client.query(
      `INSERT INTO users(full_name,email,password_hash,role,status,phone)
       VALUES($1,$2,$3,'STUDENT','ACTIVE',$4) RETURNING id`,
      [data.fullName, data.studentEmail, studentHash, data.phone || null],
    );
    const studentUserId = studentUserResult.rows[0].id;

    const studentResult = await client.query(
      `INSERT INTO students(full_name,date_of_birth,school,school_class,phone,email,parent_name,parent_phone,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE') RETURNING id`,
      [data.fullName, data.dateOfBirth || null, data.school || null, data.schoolClass || null,
        data.phone || null, data.studentEmail, data.parentName, data.parentPhone || null],
    );
    const studentId = studentResult.rows[0].id;

    await client.query('INSERT INTO student_accounts(user_id,student_id) VALUES($1,$2)', [studentUserId, studentId]);
    await client.query(
      'INSERT INTO parent_students(parent_user_id,student_id,relationship) VALUES($1,$2,$3)',
      [parentUserId, studentId, data.relationship || 'Bố/Mẹ'],
    );
    await client.query(
      `INSERT INTO student_progress_summary(student_id,average_score,attendance_rate) VALUES($1,0,0)
       ON CONFLICT(student_id) DO NOTHING`,
      [studentId],
    );
    for (const classId of classIds) {
      await client.query(
        `INSERT INTO class_students(class_id,student_id,status) VALUES($1,$2,'ACTIVE')
         ON CONFLICT(class_id,student_id) DO UPDATE SET status='ACTIVE', left_at=NULL`,
        [classId, studentId],
      );
    }
    await client.query('COMMIT');
    return findById(studentId, actorUserId, isAdmin);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function update(id, data, actorUserId = null, isAdmin = false) {
  if (env.demo.enabled) {
    const student = demoStore.students.find((item) => item.id === Number(id));
    if (!canAccessDemoStudent(student, actorUserId, isAdmin)) return null;
    const classIds = assertDemoClasses(data.classIds, actorUserId, isAdmin);
    const studentAccount = demoStore.studentAccounts.find((item) => item.studentId === student.id);
    const studentUser = studentAccount ? demoStore.users.find((item) => item.id === studentAccount.userId) : null;
    const emailOwner = demoStore.users.find((user) => user.email.toLowerCase() === data.studentEmail.toLowerCase() && user.id !== studentUser?.id);
    if (emailOwner) throw new Error('Email đăng nhập học viên đã được sử dụng.');

    let parentLink = demoStore.parentStudents.find((item) => item.studentId === student.id);
    let parentUser = parentLink ? demoStore.users.find((item) => item.id === parentLink.parentUserId) : null;
    const targetParent = demoStore.users.find((user) => user.email.toLowerCase() === data.parentEmail.toLowerCase());
    if (targetParent && targetParent.role !== 'PARENT') throw new Error('Email phụ huynh đang thuộc một tài khoản không phải phụ huynh.');
    if (targetParent && targetParent.id !== parentUser?.id) {
      parentUser = targetParent;
      if (parentLink) parentLink.parentUserId = parentUser.id;
      else {
        parentLink = { parentUserId: parentUser.id, studentId: student.id, relationship: data.relationship };
        demoStore.parentStudents.push(parentLink);
      }
    }
    if (!parentUser) {
      if (!data.parentPassword) throw new Error('Cần nhập mật khẩu khi tạo tài khoản phụ huynh mới.');
      parentUser = {
        id: nextId(demoStore.users), fullName: data.parentName, email: data.parentEmail,
        phone: data.parentPhone, passwordHash: bcrypt.hashSync(data.parentPassword, env.security.bcryptRounds),
        role: 'PARENT', status: 'ACTIVE',
      };
      demoStore.users.push(parentUser);
      parentLink = { parentUserId: parentUser.id, studentId: student.id, relationship: data.relationship };
      demoStore.parentStudents.push(parentLink);
    }
    Object.assign(parentUser, { fullName: data.parentName, email: data.parentEmail, phone: data.parentPhone, status: 'ACTIVE' });
    if (data.parentPassword) parentUser.passwordHash = bcrypt.hashSync(data.parentPassword, env.security.bcryptRounds);
    parentLink.relationship = data.relationship;

    if (studentUser) {
      Object.assign(studentUser, { fullName: data.fullName, email: data.studentEmail, phone: data.phone, status: 'ACTIVE' });
      if (data.studentPassword) studentUser.passwordHash = bcrypt.hashSync(data.studentPassword, env.security.bcryptRounds);
    } else {
      if (!data.studentPassword) throw new Error('Học viên này chưa có tài khoản. Hãy nhập mật khẩu để tạo tài khoản học viên.');
      const newStudentUser = {
        id: nextId(demoStore.users), fullName: data.fullName, email: data.studentEmail, phone: data.phone,
        passwordHash: bcrypt.hashSync(data.studentPassword, env.security.bcryptRounds), role: 'STUDENT', status: 'ACTIVE',
      };
      demoStore.users.push(newStudentUser);
      demoStore.studentAccounts.push({ userId: newStudentUser.id, studentId: student.id });
    }

    const ownedIds = new Set(visibleDemoClasses(actorUserId, isAdmin).map((item) => Number(item.id)));
    const preserved = isAdmin || !actorUserId
      ? []
      : (student.classIds || []).filter((classId) => !ownedIds.has(Number(classId)));
    Object.assign(student, {
      fullName: data.fullName,
      dateOfBirth: data.dateOfBirth || null,
      school: data.school || '',
      schoolClass: data.schoolClass || '',
      phone: data.phone || '',
      email: data.studentEmail,
      parentName: data.parentName,
      parentPhone: data.parentPhone || '',
      classIds: [...new Set([...preserved, ...classIds])],
      status: 'ACTIVE',
    });
    return publicStudentDemo(student, actorUserId, isAdmin);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(`
      SELECT s.id,
             sa.user_id AS student_user_id,
             (SELECT ps.parent_user_id FROM parent_students ps WHERE ps.student_id=s.id ORDER BY ps.parent_user_id LIMIT 1) AS parent_user_id
        FROM students s
        LEFT JOIN student_accounts sa ON sa.student_id=s.id
       WHERE s.id=$1
         AND s.deleted_at IS NULL
         AND (
           $3::boolean OR $2::bigint IS NULL OR EXISTS (
             SELECT 1
               FROM class_students own_cs
               JOIN classes own_c ON own_c.id=own_cs.class_id
              WHERE own_cs.student_id=s.id
                AND own_cs.status='ACTIVE'
                AND own_c.deleted_at IS NULL
                AND own_c.teacher_id=$2
           )
         )
       FOR UPDATE OF s
    `, [id, actorUserId, isAdmin]);
    if (!current.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const classIds = await assertClassAccess(data.classIds, actorUserId, isAdmin, client);
    const row = current.rows[0];
    if (await emailInUse(data.studentEmail, row.student_user_id, client)) throw new Error('Email đăng nhập học viên đã được sử dụng.');

    let targetParent = await client.query('SELECT id,role FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1', [data.parentEmail]);
    let parentUserId;
    if (targetParent.rows[0]) {
      if (targetParent.rows[0].role !== 'PARENT') throw new Error('Email phụ huynh đang thuộc một tài khoản không phải phụ huynh.');
      parentUserId = targetParent.rows[0].id;
    } else {
      if (!data.parentPassword) throw new Error('Cần nhập mật khẩu khi tạo tài khoản phụ huynh mới.');
      const hash = await bcrypt.hash(data.parentPassword, env.security.bcryptRounds);
      targetParent = await client.query(
        `INSERT INTO users(full_name,email,password_hash,role,status,phone)
         VALUES($1,$2,$3,'PARENT','ACTIVE',$4) RETURNING id`,
        [data.parentName, data.parentEmail, hash, data.parentPhone || null],
      );
      parentUserId = targetParent.rows[0].id;
    }

    await client.query(
      `UPDATE users SET full_name=$1,email=$2,phone=$3,status='ACTIVE',updated_at=NOW() WHERE id=$4`,
      [data.parentName, data.parentEmail, data.parentPhone || null, parentUserId],
    );
    if (data.parentPassword && Number(parentUserId) === Number(row.parent_user_id)) {
      const hash = await bcrypt.hash(data.parentPassword, env.security.bcryptRounds);
      await client.query('UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2', [hash, parentUserId]);
    }

    await client.query('DELETE FROM parent_students WHERE student_id=$1', [id]);
    await client.query(
      'INSERT INTO parent_students(parent_user_id,student_id,relationship) VALUES($1,$2,$3)',
      [parentUserId, id, data.relationship || 'Bố/Mẹ'],
    );

    let studentUserId = row.student_user_id;
    if (studentUserId) {
      await client.query(
        `UPDATE users SET full_name=$1,email=$2,phone=$3,status='ACTIVE',updated_at=NOW() WHERE id=$4`,
        [data.fullName, data.studentEmail, data.phone || null, studentUserId],
      );
      if (data.studentPassword) {
        const hash = await bcrypt.hash(data.studentPassword, env.security.bcryptRounds);
        await client.query('UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2', [hash, studentUserId]);
      }
    } else {
      if (!data.studentPassword) throw new Error('Học viên này chưa có tài khoản. Hãy nhập mật khẩu để tạo tài khoản học viên.');
      const hash = await bcrypt.hash(data.studentPassword, env.security.bcryptRounds);
      const createdUser = await client.query(
        `INSERT INTO users(full_name,email,password_hash,role,status,phone)
         VALUES($1,$2,$3,'STUDENT','ACTIVE',$4) RETURNING id`,
        [data.fullName, data.studentEmail, hash, data.phone || null],
      );
      studentUserId = createdUser.rows[0].id;
      await client.query('INSERT INTO student_accounts(user_id,student_id) VALUES($1,$2)', [studentUserId, id]);
    }

    await client.query(
      `UPDATE students SET full_name=$1,date_of_birth=$2,school=$3,school_class=$4,phone=$5,email=$6,
               parent_name=$7,parent_phone=$8,status='ACTIVE',updated_at=NOW()
       WHERE id=$9`,
      [data.fullName, data.dateOfBirth || null, data.school || null, data.schoolClass || null,
        data.phone || null, data.studentEmail, data.parentName, data.parentPhone || null, id],
    );

    if (isAdmin || !actorUserId) {
      await client.query("UPDATE class_students SET status='INACTIVE',left_at=CURRENT_DATE WHERE student_id=$1", [id]);
    } else {
      await client.query(`
        UPDATE class_students cs
           SET status='INACTIVE',left_at=CURRENT_DATE
          FROM classes c
         WHERE cs.class_id=c.id
           AND cs.student_id=$1
           AND c.teacher_id=$2
      `, [id, actorUserId]);
    }
    for (const classId of classIds) {
      await client.query(
        `INSERT INTO class_students(class_id,student_id,status,joined_at,left_at)
         VALUES($1,$2,'ACTIVE',CURRENT_DATE,NULL)
         ON CONFLICT(class_id,student_id) DO UPDATE SET status='ACTIVE',left_at=NULL`,
        [classId, id],
      );
    }

    if (row.parent_user_id && Number(row.parent_user_id) !== Number(parentUserId)) {
      await client.query(`
        UPDATE users u SET status='INACTIVE',updated_at=NOW()
         WHERE u.id=$1
           AND u.role='PARENT'
           AND NOT EXISTS (
             SELECT 1 FROM parent_students ps
             JOIN students s2 ON s2.id=ps.student_id
              WHERE ps.parent_user_id=u.id AND s2.deleted_at IS NULL
           )`, [row.parent_user_id]);
    }

    await client.query('COMMIT');
    return findById(id, actorUserId, isAdmin);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function softDelete(id, actorUserId = null, isAdmin = false) {
  if (env.demo.enabled) {
    const student = demoStore.students.find((item) => item.id === Number(id));
    if (!canAccessDemoStudent(student, actorUserId, isAdmin)) return false;

    if (!isAdmin && actorUserId) {
      const owned = new Set(visibleDemoClasses(actorUserId, false).map((item) => Number(item.id)));
      student.classIds = (student.classIds || []).filter((classId) => !owned.has(Number(classId)));
      if (student.classIds.length) return true;
    }

    student.status = 'DELETED';
    student.classIds = [];
    const studentAccount = demoStore.studentAccounts.find((item) => item.studentId === student.id);
    const studentUser = studentAccount ? demoStore.users.find((item) => item.id === studentAccount.userId) : null;
    if (studentUser) studentUser.status = 'INACTIVE';
    const parentLink = demoStore.parentStudents.find((item) => item.studentId === student.id);
    if (parentLink) {
      const hasOther = demoStore.parentStudents.some((item) => item.parentUserId === parentLink.parentUserId
        && item.studentId !== student.id
        && demoStore.students.some((candidate) => candidate.id === item.studentId && candidate.status !== 'DELETED'));
      if (!hasOther) {
        const parentUser = demoStore.users.find((item) => item.id === parentLink.parentUserId);
        if (parentUser) parentUser.status = 'INACTIVE';
      }
    }
    return true;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      SELECT sa.user_id AS student_user_id,
             (SELECT ps.parent_user_id FROM parent_students ps WHERE ps.student_id=s.id ORDER BY ps.parent_user_id LIMIT 1) AS parent_user_id
        FROM students s
        LEFT JOIN student_accounts sa ON sa.student_id=s.id
       WHERE s.id=$1
         AND s.deleted_at IS NULL
         AND (
           $3::boolean OR $2::bigint IS NULL OR EXISTS (
             SELECT 1 FROM class_students own_cs
             JOIN classes own_c ON own_c.id=own_cs.class_id
              WHERE own_cs.student_id=s.id
                AND own_cs.status='ACTIVE'
                AND own_c.deleted_at IS NULL
                AND own_c.teacher_id=$2
           )
         )
       FOR UPDATE OF s
    `, [id, actorUserId, isAdmin]);
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return false;
    }

    if (!isAdmin && actorUserId) {
      await client.query(`
        UPDATE class_students cs
           SET status='INACTIVE',left_at=CURRENT_DATE
          FROM classes c
         WHERE cs.class_id=c.id
           AND cs.student_id=$1
           AND cs.status='ACTIVE'
           AND c.teacher_id=$2
      `, [id, actorUserId]);
      const remaining = await client.query(
        "SELECT 1 FROM class_students WHERE student_id=$1 AND status='ACTIVE' LIMIT 1",
        [id],
      );
      if (remaining.rows[0]) {
        await client.query('COMMIT');
        return true;
      }
    }

    await client.query("UPDATE students SET status='INACTIVE',deleted_at=NOW(),updated_at=NOW() WHERE id=$1", [id]);
    await client.query("UPDATE class_students SET status='INACTIVE',left_at=CURRENT_DATE WHERE student_id=$1", [id]);
    if (rows[0].student_user_id) {
      await client.query("UPDATE users SET status='INACTIVE',updated_at=NOW() WHERE id=$1", [rows[0].student_user_id]);
    }
    if (rows[0].parent_user_id) {
      await client.query(`
        UPDATE users u SET status='INACTIVE',updated_at=NOW()
         WHERE u.id=$1 AND u.role='PARENT'
           AND NOT EXISTS (
             SELECT 1 FROM parent_students ps
             JOIN students s2 ON s2.id=ps.student_id
              WHERE ps.parent_user_id=u.id AND s2.deleted_at IS NULL AND s2.id<>$2
           )`, [rows[0].parent_user_id, id]);
    }
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { findAll, findById, create, update, softDelete };
