import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CatalogPriceRepository } from './catalog-price.repository.js';
import { parseCreatePrice, parseUpdatePrice } from './dto/price.dto.js';

@Injectable()
export class CatalogPriceService {
  constructor(private readonly repository: CatalogPriceRepository) {}

  list() { return this.repository.list(); }

  async create(body: unknown) {
    const dto = parseCreatePrice(body);
    await this.validate(dto);
    const id = await this.repository.insert(dto);
    return this.get(id);
  }

  async update(id: number, body: unknown) {
    const current = await this.get(id);
    const dto = parseUpdatePrice(body);
    const next = {
      pitchId: dto.pitchId ?? current.pitchId,
      dayType: dto.dayType ?? current.dayType,
      start: dto.start ?? current.start,
      end: dto.end ?? current.end,
      amount: dto.amount ?? current.amount,
      depositPercent: dto.depositPercent ?? current.depositPercent,
    };
    if (next.start >= next.end) throw new BadRequestException('Giờ kết thúc phải sau giờ bắt đầu');
    await this.validate(next, id);
    await this.repository.update(id, dto);
    return this.get(id);
  }

  async delete(id: number) {
    await this.get(id);
    await this.repository.remove(id);
    return { id };
  }

  private async get(id: number) {
    const row = await this.repository.findById(id);
    if (!row) throw new NotFoundException('Không tìm thấy dòng bảng giá');
    return row;
  }

  private async validate(dto: { pitchId: number; dayType: 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY'; start: string; end: string }, exceptId?: number) {
    if (!(await this.repository.pitchExists(dto.pitchId))) throw new BadRequestException('Sân không tồn tại');
    if (await this.repository.hasOverlap(dto, exceptId)) {
      throw new ConflictException('Khung giờ bảng giá bị trùng với một cấu hình khác của cùng sân và loại ngày');
    }
  }
}
