import { BadRequestException, Injectable } from '@nestjs/common';
import { ReportsRepository } from './reports.repository.js';

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

@Injectable()
export class ReportsService {
  constructor(private readonly repository: ReportsRepository) {}

  async summary(from?: string, to?: string) {
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    const start = from ?? today;
    const end = to ?? start;
    if (!validDate(start) || !validDate(end)) throw new BadRequestException('Ngày phải theo định dạng YYYY-MM-DD.');
    const days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
    if (days < 0 || days > 365) throw new BadRequestException('Khoảng ngày phải từ 1 đến 366 ngày.');

    const [events, bookings, occupancy] = await Promise.all([
      this.repository.cashEvents(start, end),
      this.repository.bookingCounts(start, end),
      this.repository.occupancy(start, end),
    ]);
    const daily = new Map<string, { date: string; pitch: number; service: number; refunded: number; net: number }>();
    for (let i = 0; i <= days; i++) {
      const date = new Date(Date.parse(`${start}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
      daily.set(date, { date, pitch: 0, service: 0, refunded: 0, net: 0 });
    }
    let pitchCollected = 0, serviceCollected = 0, refunded = 0;
    for (const event of events) {
      const row = daily.get(event.localDate);
      if (!row) continue;
      const amount = Number(event.amount);
      const pitchValue = Number(event.pitchAmount);
      const serviceValue = Number(event.serviceAmount);
      // A booking deposit covers both pitch and selected services; allocate proportionally.
      const pitch = event.serviceOnly || pitchValue + serviceValue <= 0 ? 0 : Math.round(amount * pitchValue / (pitchValue + serviceValue));
      const service = amount - pitch;
      if (event.kind === 'PAYMENT') {
        pitchCollected += pitch; serviceCollected += service;
        row.pitch += pitch; row.service += service; row.net += amount;
      } else {
        refunded += amount; row.refunded += amount; row.net -= amount;
      }
    }
    return {
      from: start, to: end, confirmedBookings: Number(bookings.confirmed), pendingBookings: Number(bookings.pending),
      filledSlots: Number(occupancy.filled), availableSlots: Number(occupancy.capacity),
      occupancyPercent: Number(occupancy.capacity) ? Math.round(Number(occupancy.filled) * 10000 / Number(occupancy.capacity)) / 100 : 0,
      pitchCollected, serviceCollected, refunded, netCollected: pitchCollected + serviceCollected - refunded,
      daily: [...daily.values()],
    };
  }
}
