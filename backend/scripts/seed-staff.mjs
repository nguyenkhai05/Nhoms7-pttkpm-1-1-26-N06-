import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const staff = [
  { role: 'ADMIN', email: process.env.SEED_ADMIN_EMAIL || 'admin@example.test', name: 'Quản trị viên', password: process.env.SEED_ADMIN_PASSWORD },
  { role: 'MANAGER', email: process.env.SEED_MANAGER_EMAIL || 'manager@example.test', name: 'Quản lý', password: process.env.SEED_MANAGER_PASSWORD },
  { role: 'RECEPTIONIST', email: process.env.SEED_RECEPTIONIST_EMAIL || 'reception@example.test', name: 'Lễ tân', password: process.env.SEED_RECEPTIONIST_PASSWORD },
  { role: 'ACCOUNTANT', email: process.env.SEED_ACCOUNTANT_EMAIL || 'accountant@example.test', name: 'Kế toán', password: process.env.SEED_ACCOUNTANT_PASSWORD },
];

for (const user of staff) {
  if (!user.password || user.password.length < 8) {
    throw new Error(`Thiếu mật khẩu hợp lệ (tối thiểu 8 ký tự) cho ${user.role}. Cấu hình biến SEED_${user.role}_PASSWORD trong backend/.env.`);
  }
}

const db = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'football_app',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'football_management',
  charset: 'utf8mb4',
});

try {
  await db.beginTransaction();
  for (const user of staff) {
    const passwordHash = await bcrypt.hash(user.password, 12);
    await db.execute(
      `INSERT INTO users (fullName,email,passwordHash,status) VALUES (?,?,?,'ACTIVE')
       ON DUPLICATE KEY UPDATE fullName=VALUES(fullName), passwordHash=VALUES(passwordHash), status='ACTIVE'`,
      [user.name, user.email.trim().toLowerCase(), passwordHash],
    );
    const [[stored]] = await db.execute('SELECT id FROM users WHERE email=?', [user.email.trim().toLowerCase()]);
    const [[role]] = await db.execute('SELECT id FROM roles WHERE code=?', [user.role]);
    if (!stored || !role) throw new Error(`Không tìm thấy user/role ${user.role}. Hãy chạy database/03_seed.sql trước.`);
    await db.execute('INSERT IGNORE INTO user_roles (userId,roleId) VALUES (?,?)', [stored.id, role.id]);
  }
  await db.commit();
  process.stdout.write('Đã tạo/cập nhật 4 tài khoản nhân viên. Không hiển thị mật khẩu.\n');
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}
