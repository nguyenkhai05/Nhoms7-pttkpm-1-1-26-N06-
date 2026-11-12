/**
 * Chuẩn hóa số điện thoại Việt Nam về dạng 10 chữ số bắt đầu bằng 0.
 * Chấp nhận khoảng trắng, dấu chấm, ngoặc, dấu gạch và đầu số +84/84.
 */
export function normalizeVietnamesePhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('84')) {
    const nationalNumber = digits.slice(2);
    digits = nationalNumber.startsWith('0') ? nationalNumber : `0${nationalNumber}`;
  } else if (digits.length === 9) {
    digits = `0${digits}`;
  }
  return digits;
}

export function isValidVietnamesePhone(value: string): boolean {
  return /^0\d{9}$/.test(value);
}
