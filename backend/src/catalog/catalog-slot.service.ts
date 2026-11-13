import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { uncoveredDayTypes } from './catalog-slot.coverage.js';
import { CatalogSlotRepository, type CatalogSlot } from './catalog-slot.repository.js';
import { toHttpError } from './catalog.errors.js';
import { parseCreateSlot } from './dto/slot.dto.js';

/** Quy tắc nghiệp vụ của ca giờ. Không viết SQL ở đây. */
@Injectable()
export class CatalogSlotService {
  constructor(@Inject(CatalogSlotRepository) private readonly repository: CatalogSlotRepository) {}

  async listSlots(pitchId: number) {
    await this.requirePitch(pitchId);
    const [slots, windows] = await Promise.all([
      this.repository.list(pitchId),
      this.repository.priceWindows(pitchId),
    ]);
    return slots.map((slot) => ({ ...slot, uncoveredDayTypes: uncoveredDayTypes(slot, windows) }));
  }

  async createSlot(pitchId: number, body: unknown) {
    const dto = parseCreateSlot(body);
    await this.requirePitch(pitchId);
    let slotId: number;
    try {
      slotId = await this.repository.insert(pitchId, dto);
    } catch (error) {
      throw this.toSlotError(error);
    }
    const windows = await this.repository.priceWindows(pitchId);
    const slot = (await this.repository.findById(pitchId, slotId)) as CatalogSlot;
    return { ...slot, uncoveredDayTypes: uncoveredDayTypes(slot, windows) };
  }

  async deleteSlot(pitchId: number, slotId: number) {
    await this.requirePitch(pitchId);
    if (!(await this.repository.findById(pitchId, slotId))) {
      throw new NotFoundException('Không tìm thấy ca giờ');
    }
    if ((await this.repository.countUsage(slotId)) > 0) {
      throw new ConflictException('Ca đã có đơn đặt hoặc lịch sử giữ chỗ nên không thể xóa');
    }
    try {
      await this.repository.remove(pitchId, slotId);
    } catch (error) {
      throw toHttpError(error, { inUse: 'Ca đang được dữ liệu khác sử dụng nên không thể xóa' });
    }
    return { id: slotId };
  }

  private async requirePitch(pitchId: number) {
    if (!(await this.repository.pitchExists(pitchId))) {
      throw new NotFoundException('Không tìm thấy sân');
    }
  }

  /** Lỗi do sp_add_slot báo bằng SIGNAL, đọc thông điệp để đổi sang mã HTTP phù hợp. */
  private toSlotError(error: unknown): unknown {
    const message = (error as { sqlMessage?: string } | null)?.sqlMessage ?? '';
    if (/overlapping slots/i.test(message)) {
      return new ConflictException('Ca giờ bị trùng với một ca khác của sân');
    }
    if (/invalid pitch or time/i.test(message)) {
      return new BadRequestException('Sân hoặc khung giờ không hợp lệ');
    }
    return toHttpError(error);
  }
}