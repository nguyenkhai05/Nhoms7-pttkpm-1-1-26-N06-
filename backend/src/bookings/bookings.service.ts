import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { BookingsRepository, type RequestedService } from './bookings.repository.js';
import { RedisLockService } from './redis-lock.service.js';

const HOLD_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class BookingsService implements OnModuleInit, OnModuleDestroy {
  private expiryTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly repository: BookingsRepository,
    private readonly redis: RedisLockService,
  ) {}

  onModuleInit() {
    this.expiryTimer = setInterval(() => {
      void this.expirePendingHolds().catch((error: unknown) => {
        console.error('Không thể xử lý Booking hết hạn:', error);
      });
    }, 10_000);
    this.expiryTimer.unref();
    void this.expirePendingHolds().catch((error: unknown) => {
      console.error('Không thể chạy lần dọn Booking đầu tiên:', error);
    });
  }

  onModuleDestroy() {
    if (this.expiryTimer) clearInterval(this.expiryTimer);
  }

  async listServices(pitchIdValue: string) {
    const pitchId = Number(pitchIdValue);
    if (!Number.isSafeInteger(pitchId) || pitchId <= 0) {
      throw new BadRequestException('pitchId không hợp lệ.');
    }
    return this.repository.listServices(pitchId);
  }

  async createHold(
    user: { id: number; roles: string[] },
    body: { pitchId?: number; slotId?: number; date?: string; services?: RequestedService[] },
  ) {
    if (!user.roles.includes('CUSTOMER')) {
      throw new ForbiddenException('Chỉ khách hàng mới được tự đặt sân trực tuyến.');
    }

    const pitchId = Number(body.pitchId);
    const slotId = Number(body.slotId);
    const date = body.date ?? '';
    if (!Number.isSafeInteger(pitchId) || pitchId <= 0 ||
        !Number.isSafeInteger(slotId) || slotId <= 0 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('Thông tin sân, khung giờ hoặc ngày đặt không hợp lệ.');
    }
    const parsedDate = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      throw new BadRequestException('Ngày đặt không hợp lệ.');
    }

    const services = this.normalizeServices(body.services ?? []);
    const key = this.slotKey(pitchId, slotId, date);
    const token = randomUUID();
    const startedAt = Date.now();
    const acquired = await this.redis.acquire(key, token, HOLD_TTL_MS);
    if (!acquired) {
      throw new ConflictException('Khung giờ này vừa có người giữ chỗ. Vui lòng chọn khung giờ khác.');
    }

    let bookingId: number | undefined;
    try {
      const code = `DSN-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
      bookingId = await this.repository.holdSlot(pitchId, slotId, date, user.id, code, services);
      const remainingTtl = Math.max(1, HOLD_TTL_MS - (Date.now() - startedAt));
      const promoted = await this.redis.promote(key, token, `booking:${bookingId}`, remainingTtl);
      if (!promoted) {
        await this.repository.cancelHold(bookingId, user.id);
        throw new ServiceUnavailableException('Không thể xác nhận khóa giữ chỗ. Vui lòng thử lại.');
      }
      const booking = await this.repository.findForCustomer(bookingId, user.id);
      if (!booking) throw new Error('Không tìm thấy Booking vừa tạo.');
      return booking;
    } catch (error) {
      if (bookingId) {
        try {
          await this.repository.cancelHold(bookingId, user.id);
        } catch {
          // If MySQL is unavailable, the expiry worker will release the hold later.
        }
        await this.redis.release(key, `booking:${bookingId}`);
      } else {
        await this.redis.release(key, token);
      }
      this.throwBookingError(error);
    }
  }

  async getBooking(bookingIdValue: string, customerId: number) {
    const bookingId = Number(bookingIdValue);
    if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
      throw new BadRequestException('Mã Booking không hợp lệ.');
    }
    const booking = await this.repository.findForCustomer(bookingId, customerId);
    if (!booking) throw new NotFoundException('Không tìm thấy Booking.');
    return booking;
  }

  async cancelHold(bookingIdValue: string, customerId: number) {
    const bookingId = Number(bookingIdValue);
    if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
      throw new BadRequestException('Mã Booking không hợp lệ.');
    }
    const booking = await this.repository.findForCustomer(bookingId, customerId);
    if (!booking) throw new NotFoundException('Không tìm thấy Booking.');
    const key = this.slotKey(booking.pitchId, booking.slotId, booking.date);
    try {
      await this.repository.cancelHold(bookingId, customerId);
      await this.redis.release(key, `booking:${bookingId}`);
      return { bookingId, status: 'CANCELLED' };
    } catch (error) {
      this.throwBookingError(error);
    }
  }

  private normalizeServices(input: RequestedService[]): RequestedService[] {
    if (!Array.isArray(input) || input.length > 30) {
      throw new BadRequestException('Danh sách dịch vụ không hợp lệ.');
    }
    const seen = new Set<number>();
    return input.map((item) => {
      const serviceId = Number(item?.serviceId);
      const quantity = Number(item?.quantity);
      if (!Number.isSafeInteger(serviceId) || serviceId <= 0 ||
          !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 100 ||
          seen.has(serviceId)) {
        throw new BadRequestException('Mỗi dịch vụ phải có mã hợp lệ, số lượng từ 1 đến 100 và không được lặp.');
      }
      seen.add(serviceId);
      return { serviceId, quantity };
    }).sort((a, b) => a.serviceId - b.serviceId);
  }

  private slotKey(pitchId: number, slotId: number, date: string) {
    return `booking:slot:${pitchId}:${slotId}:${date}`;
  }

  private async expirePendingHolds() {
    const expired = await this.repository.expiredHolds();
    if (!expired.length) return;
    await this.repository.expirePendingBookings();
    await Promise.all(expired.map((hold) =>
      this.redis.release(
        this.slotKey(hold.pitchId, hold.slotId, hold.date),
        `booking:${hold.bookingId}`,
      ),
    ));
  }

  private throwBookingError(error: unknown): never {
    if (error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof ServiceUnavailableException) throw error;

    const value = error as { code?: string; sqlMessage?: string; message?: string };
    const message = value?.sqlMessage ?? value?.message ?? '';
    if (/already occupied|slot.*occupied/i.test(message)) {
      throw new ConflictException('Khung giờ này vừa có người giữ chỗ. Vui lòng chọn khung giờ khác.');
    }
    if (/stock is insufficient|service.*unavailable/i.test(message)) {
      throw new ConflictException('Dịch vụ đã hết hoặc không đủ số lượng tồn kho. Vui lòng điều chỉnh số lượng.');
    }
    if (/past/i.test(message)) throw new BadRequestException('Không thể đặt khung giờ đã qua.');
    if (/active customer required/i.test(message)) throw new ForbiddenException('Tài khoản khách hàng không còn hoạt động.');
    if (/maintenance|pitch unavailable/i.test(message)) {
      throw new ConflictException('Sân hiện không khả dụng trong khung giờ đã chọn.');
    }
    if (/price rule/i.test(message)) {
      throw new ConflictException('Sân chưa được cấu hình giá hợp lệ cho ngày và khung giờ này.');
    }
    if (value?.code === 'ER_SIGNAL_EXCEPTION') {
      throw new ConflictException(message || 'Không thể giữ khung giờ này.');
    }
    throw error instanceof Error ? error : new Error('Không thể tạo Booking.');
  }
}
