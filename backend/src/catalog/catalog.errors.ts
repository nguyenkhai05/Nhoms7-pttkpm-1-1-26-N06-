import { BadRequestException, ConflictException } from '@nestjs/common';

/** Đổi lỗi MySQL thường gặp thành lỗi HTTP dễ hiểu; lỗi khác giữ nguyên. */
export function toHttpError(error: unknown): unknown {
  const errno =
    typeof error === 'object' && error !== null && 'errno' in error
      ? (error as { errno: unknown }).errno
      : undefined;
  if (errno === 1451) {
    return new ConflictException('Đang được dữ liệu khác sử dụng nên không thể xóa');
  }
  if (errno === 1062) return new ConflictException('Dữ liệu bị trùng');
  if (errno === 1452) return new BadRequestException('Dữ liệu tham chiếu không tồn tại');
  return error;
}