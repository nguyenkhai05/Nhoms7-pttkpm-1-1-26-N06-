import type { PriceDayType } from './dto/price.dto.js';

export const DAY_TYPES: readonly PriceDayType[] = ['WEEKDAY', 'WEEKEND', 'HOLIDAY'];

export interface PriceWindow {
  dayType: PriceDayType;
  start: string;
  end: string;
}

/**
 * Các loại ngày mà ca này KHÔNG đặt được vì thiếu giá hoặc trùng giá.
 * Cùng điều kiện với sp_hold_slot: ca phải nằm trọn trong đúng một dòng giá.
 */
export function uncoveredDayTypes(
  slot: { start: string; end: string },
  windows: PriceWindow[],
): PriceDayType[] {
  return DAY_TYPES.filter((dayType) => {
    const matches = windows.filter(
      (window) => window.dayType === dayType && window.start <= slot.start && window.end >= slot.end,
    );
    return matches.length !== 1;
  });
}