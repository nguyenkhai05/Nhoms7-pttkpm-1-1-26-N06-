import { Injectable, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { createRequire } from 'node:module';

type RedisClient = {
  isOpen: boolean;
  on(event: 'error', listener: (error: Error) => void): void;
  connect(): Promise<unknown>;
  ping(): Promise<string>;
  set(key: string, value: string, options: { NX: true; PX: number }): Promise<string | null>;
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>;
  quit(): Promise<unknown>;
};
type RedisClientOptions = {
  url: string;
  socket: {
    connectTimeout: number;
    reconnectStrategy: (retries: number) => number;
  };
};
const require = createRequire(import.meta.url);
const { createClient } = require('redis') as {
  createClient: (options: RedisClientOptions) => RedisClient;
};

@Injectable()
export class RedisLockService implements OnModuleInit, OnModuleDestroy {
  private readonly client = createClient({
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    socket: { connectTimeout: 5000, reconnectStrategy: (retries) => Math.min(retries * 200, 3000) },
  });

  async onModuleInit() {
    this.client.on('error', (error) => console.error('Redis error:', error.message));
    try {
      if (!this.client.isOpen) await this.client.connect();
      await this.client.ping();
    } catch {
      throw new ServiceUnavailableException('Không thể kết nối Redis. Hệ thống tạm thời không nhận đặt sân.');
    }
  }

  async onModuleDestroy() {
    if (this.client.isOpen) await this.client.quit();
  }

  async acquire(key: string, token: string, ttlMs: number): Promise<boolean> {
    try {
      return (await this.client.set(key, token, { NX: true, PX: ttlMs })) === 'OK';
    } catch {
      throw new ServiceUnavailableException('Redis không khả dụng. Vui lòng thử lại sau.');
    }
  }

  async promote(key: string, oldValue: string, newValue: string, ttlMs: number): Promise<boolean> {
    const script = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
        return 1
      end
      return 0
    `;
    try {
      const result = await this.client.eval(script, {
        keys: [key],
        arguments: [oldValue, newValue, String(ttlMs)],
      });
      return Number(result) === 1;
    } catch {
      throw new ServiceUnavailableException('Không thể xác nhận khóa Redis. Vui lòng thử lại.');
    }
  }

  async release(key: string, expectedValue: string): Promise<void> {
    const script = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      end
      return 0
    `;
    try {
      await this.client.eval(script, { keys: [key], arguments: [expectedValue] });
    } catch {
      // MySQL remains authoritative; Redis TTL is the fallback release mechanism.
    }
  }
}
