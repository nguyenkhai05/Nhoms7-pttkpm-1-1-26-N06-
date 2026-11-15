import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module.js';
import { AuthRepository } from '../src/auth/auth.repository.js';
import { MysqlDatabase } from '../src/database/mysqlDatabase.js';
import { RedisLockService } from '../src/bookings/redis-lock.service.js';

describe('Quản lý nhân sự: phân quyền API', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const db = { pool: { execute: async () => [[{ id: 3, fullName: 'Lễ tân', email: 'staff@example.test', phone: null, status: 'ACTIVE', roles: 'RECEPTIONIST' }], []] } };
    const auth = {
      findByUserId: async (id: number) => ({ id, status: 'ACTIVE' }),
      getUserAccess: async (id: number) => ({ roles: id === 1 ? ['ADMIN'] : ['CUSTOMER'], permissions: id === 1 ? ['USER_WRITE'] : [] }),
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MysqlDatabase).useValue(db)
      .overrideProvider(RedisLockService).useValue({})
      .overrideProvider(AuthRepository).useValue(auth)
      .overrideProvider(JwtService).useValue({ verifyAsync: async (token: string) => ({ sub: token === 'admin' ? 1 : 2 }) })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app?.close(); });

  it('từ chối người chưa đăng nhập và khách hàng, cho Admin xem danh sách', async () => {
    await request(app.getHttpServer()).get('/api/admin/users').expect(401);
    await request(app.getHttpServer()).get('/api/admin/users').set('Authorization', 'Bearer customer').expect(403);
    const response = await request(app.getHttpServer()).get('/api/admin/users').set('Authorization', 'Bearer admin').expect(200);
    expect(response.body.data.items[0]).toMatchObject({ email: 'staff@example.test', roles: ['RECEPTIONIST'] });
    expect(response.body.data.items[0]).not.toHaveProperty('passwordHash');
  });
});
