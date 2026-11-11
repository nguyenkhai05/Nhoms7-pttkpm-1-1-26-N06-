import 'dotenv/config';
import { createPool } from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 12) {
  throw new Error('Đặt BOOTSTRAP_ADMIN_EMAIL và BOOTSTRAP_ADMIN_PASSWORD (tối thiểu 12 ký tự) trong backend/.env.');
}
const pool = createPool({ host:process.env.DB_HOST || '127.0.0.1', port:Number(process.env.DB_PORT || 3306),
  user:process.env.DB_USER || 'football_app', password:process.env.DB_PASSWORD || '',
  database:process.env.DB_NAME || 'football_management' });
const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  const [active] = await connection.query(`SELECT COUNT(*) AS n FROM users u
    JOIN user_roles ur ON ur.userId=u.id JOIN roles r ON r.id=ur.roleId
    WHERE r.code='ADMIN' AND u.status='ACTIVE'`);
  if (Number(active[0].n) > 0) throw new Error('Đã có quản trị viên đang hoạt động; không tạo thêm tài khoản khởi tạo.');
  const [roles] = await connection.execute("SELECT id FROM roles WHERE code='ADMIN'");
  if (!roles.length) throw new Error('Chưa có vai trò ADMIN; cần chạy database/03_seed.sql.');
  const hash = await bcrypt.hash(password, 12);
  const [result] = await connection.execute(
    'INSERT INTO users(fullName,email,passwordHash,status) VALUES(?,?,?,?)',
    [process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Quản trị viên',email,hash,'ACTIVE']);
  await connection.execute('INSERT INTO user_roles(userId,roleId) VALUES(?,?)', [result.insertId,roles[0].id]);
  await connection.commit();
  process.stdout.write(`Đã tạo quản trị viên ${email}.\n`);
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
  await pool.end();
}
