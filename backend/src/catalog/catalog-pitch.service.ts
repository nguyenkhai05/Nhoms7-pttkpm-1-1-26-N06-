import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CatalogPitchRepository } from './catalog-pitch.repository.js';
import { toHttpError } from './catalog.errors.js';
import { parseCreatePitch, parseUpdatePitch } from './dto/pitch.dto.js';

/** Quy tắc nghiệp vụ của sân và tiện ích. Không viết SQL ở đây. */
@Injectable()
export class CatalogPitchService {
  constructor(@Inject(CatalogPitchRepository) private readonly repository: CatalogPitchRepository) {}

  listAmenities() {
    return this.repository.listAmenities();
  }

  listPitches(complexId?: number) {
    return this.repository.findAll(complexId);
  }

  async getPitch(id: number) {
    const pitch = await this.repository.findById(id);
    if (!pitch) throw new NotFoundException('Không tìm thấy sân');
    return pitch;
  }

  async createPitch(body: unknown) {
    const dto = parseCreatePitch(body);
    await this.requireComplex(dto.complexId);
    const id = await this.run(() => this.repository.insert(dto));
    return this.getPitch(id);
  }

  async updatePitch(id: number, body: unknown) {
    const dto = parseUpdatePitch(body);
    const current = await this.getPitch(id);
    if (dto.complexId !== undefined) await this.requireComplex(dto.complexId);
    // sp_hold_slot từ chối mọi sân không ACTIVE, nên chỉ cần chặn khi còn đơn đặt đang có hiệu lực.
    if (
      current.status === 'ACTIVE' &&
      dto.status !== undefined &&
      dto.status !== 'ACTIVE' &&
      (await this.repository.countUpcomingBookings(id)) > 0
    ) {
      throw new ConflictException(
        'Sân còn đơn đặt trong tương lai, hãy xử lý các đơn đó trước khi đổi trạng thái',
      );
    }
    await this.run(() => this.repository.update(id, dto));
    return this.getPitch(id);
  }

  async deletePitch(id: number) {
    await this.getPitch(id);
    const used = await this.repository.countDependents(id);
    if (used.slots + used.prices + used.blocks > 0) {
      throw new ConflictException(
        'Sân đã có ca, bảng giá hoặc lịch bảo trì nên không thể xóa; hãy chuyển sang trạng thái INACTIVE',
      );
    }
    await this.run(() => this.repository.remove(id));
    return { id };
  }

  private async requireComplex(complexId: number) {
    if (!(await this.repository.complexExists(complexId))) {
      throw new BadRequestException('Cụm sân không tồn tại');
    }
  }

  private async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw toHttpError(error, {
        duplicate: 'Tên sân đã tồn tại trong cụm sân này',
        inUse: 'Sân đang được dữ liệu khác sử dụng nên không thể xóa',
      });
    }
  }
}