import { BadRequestException, ConflictException } from '@nestjs/common';

export interface ErrorMessages {
  /** Thông báo khi vi phạm ràng buộc UNIQUE (mã lỗi MySQL 1062). */
  duplicate?: string;
  /** Thông báo khi bị khóa ngoại chặn xóa (mã lỗi MySQL 1451). */
  inUse?: string;
}

/** Đổi lỗi MySQL thường gặp thành lỗi HTTP dễ hiểu; lỗi khác giữ nguyên. */
export function toHttpError(error: unknown, messages: ErrorMessages = {}): unknown {
  const errno =
    typeof error === 'object' && error !== null && 'errno' in error
      ? (error as { errno: unknown }).errno
      : undefined;
  if (errno === 1451) {
    return new ConflictException(
      messages.inUse ?? 'Đang được dữ liệu khác sử dụng nên không thể xóa',
    );
  }
  if (errno === 1062) {
    return new ConflictException(messages.duplicate ?? 'Dữ liệu bị trùng');
  }
  if (errno === 1452) return new BadRequestException('Dữ liệu tham chiếu không tồn tại');
  return error;
}