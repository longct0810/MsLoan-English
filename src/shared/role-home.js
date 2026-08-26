function getRoleHome(role) {
  switch (role) {
    case 'STUDENT': return '/student';
    case 'PARENT': return '/parent';
    case 'ADMIN':
    case 'TEACHER':
    default: return '/dashboard';
  }
}

module.exports = { getRoleHome };
