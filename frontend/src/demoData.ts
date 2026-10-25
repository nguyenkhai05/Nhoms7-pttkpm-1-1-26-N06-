import type { Matrix, Pitch } from './types';

export const demoPitches: Pitch[] = [
  { id: 1, name: 'Sân A1', type: 7, complexName: 'Cụm sân Sao Mai', district: 'Quận 7', address: '28 Nguyễn Thị Thập, Quận 7, TP.HCM', grass: 'Cỏ nhân tạo thế hệ mới', lights: 'Đèn LED', image: '', startingPrice: 350000, amenities: [{ id: 1, name: 'Bãi xe' }, { id: 2, name: 'Phòng thay đồ' }, { id: 4, name: 'Đèn chiếu sáng' }], prices: [{ id: 1, dayType: 'WEEKDAY', start: '06:00', end: '17:00', amount: 350000 }, { id: 2, dayType: 'WEEKDAY', start: '17:00', end: '22:00', amount: 500000 }, { id: 3, dayType: 'WEEKEND', start: '06:00', end: '22:00', amount: 550000 }] },
  { id: 2, name: 'Sân B2', type: 5, complexName: 'Cụm sân Sao Mai', district: 'Quận 7', address: '28 Nguyễn Thị Thập, Quận 7, TP.HCM', grass: 'Cỏ nhân tạo', lights: 'Đèn LED', image: '', startingPrice: 250000, amenities: [{ id: 1, name: 'Bãi xe' }, { id: 3, name: 'Vòi tắm' }], prices: [{ id: 4, dayType: 'WEEKDAY', start: '06:00', end: '17:00', amount: 250000 }, { id: 5, dayType: 'WEEKEND', start: '17:00', end: '22:00', amount: 380000 }] },
  { id: 3, name: 'Sân C3', type: 11, complexName: 'Cụm sân Bình Minh', district: 'Thủ Đức', address: '12 Võ Văn Ngân, TP. Thủ Đức, TP.HCM', grass: 'Cỏ nhân tạo', lights: 'Đèn LED', image: '', startingPrice: 700000, amenities: [{ id: 1, name: 'Bãi xe' }, { id: 2, name: 'Phòng thay đồ' }, { id: 3, name: 'Vòi tắm' }], prices: [{ id: 6, dayType: 'WEEKDAY', start: '06:00', end: '22:00', amount: 700000 }] },
];

export function demoMatrix(pitchId: number, date: string): Matrix {
  const base = [
    ['06:00', '07:30', 'GREEN'], ['07:30', '09:00', 'GREEN'],
    ['16:00', '17:30', 'GREEN'], ['17:30', '19:00', 'RED'],
    ['19:00', '20:30', 'YELLOW'], ['20:30', '22:00', 'GREEN'],
  ] as const;
  return { pitchId, date, updatedAt: new Date().toISOString(), slots: base.map(([start, end, status], index) => ({ id: index + 1, start, end, status, price: index > 1 ? 500000 : 350000, reason: status === 'GREEN' ? 'AVAILABLE' : status === 'YELLOW' ? 'HELD' : 'BOOKED' })) };
}

export function filterDemo(q: Record<string, string>): Pitch[] {
  const min = Number(q.minPrice || 0), max = Number(q.maxPrice || Infinity);
  return demoPitches.filter(p => (!q.type || p.type === Number(q.type)) && (!q.district || (p.district + ' ' + p.address).toLocaleLowerCase('vi').includes(q.district.toLocaleLowerCase('vi'))) && p.startingPrice >= min && p.startingPrice <= max && (!q.amenities || p.amenities.some(a => a.id === Number(q.amenities))));
}
