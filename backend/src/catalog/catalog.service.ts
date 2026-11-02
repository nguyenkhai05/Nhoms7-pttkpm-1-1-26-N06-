import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CatalogRepository } from './catalog.repository.js';
import { toHttpError } from './catalog.errors.js';
import { parseCreateComplex, parseUpdateComplex } from './dto/complex.dto.js';

/** Quy tắc nghiệp vụ của danh mục sân. Không viết SQL ở đây. */
@Injectable()
export class CatalogService {
  constructor(@Inject(CatalogRepository) private readonly repository: CatalogRepository) {}

  listComplexes() {
    return this.repository.findAll();
  }

  async getComplex(id: number) {
    const complex = await this.repository.findById(id);
    if (!complex) throw new NotFoundException('Không tìm thấy cụm sân');
    return complex;
  }

  async createComplex(body: unknown) {
    const dto = parseCreateComplex(body);
    const id = await this.run(() => this.repository.insert(dto));
    return this.getComplex(id);
  }

  async updateComplex(id: number, body: unknown) {
    const dto = parseUpdateComplex(body);
    await this.getComplex(id);
    await this.run(() => this.repository.update(id, dto));
    return this.getComplex(id);
  }

  async deleteComplex(id: number) {
    await this.getComplex(id);
    if ((await this.repository.countPitches(id)) > 0) {
      throw new ConflictException('Cụm sân vẫn còn sân, hãy xóa hoặc chuyển sân trước');
    }
    await this.run(() => this.repository.remove(id));
    return { id };
  }

  private async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw toHttpError(error);
    }
  }
}