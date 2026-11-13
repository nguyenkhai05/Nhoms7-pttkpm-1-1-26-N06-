import type { PoolConnection } from 'mysql2/promise';
import type { MysqlDatabase } from '../database/mysqlDatabase.js';

/** Chạy một nhóm câu lệnh trong cùng một giao dịch: hoặc tất cả thành công, hoặc hoàn tác hết. */
export async function inTransaction<T>(
  db: MysqlDatabase,
  work: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}