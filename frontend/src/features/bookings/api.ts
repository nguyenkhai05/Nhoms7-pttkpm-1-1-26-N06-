import type { CurrentBooking } from '../../lib/AppContext';

export interface BookingService {
  id: number;
  name: string;
  kind: 'SALE' | 'RENTAL';
  unit: string;
  price: number;
  availableQuantity: number;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`/api/bookings${path}`, { ...options, headers });
  } catch {
    throw new Error('Không thể kết nối backend. Vui lòng thử lại.');
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? payload.message
        : null;
    throw new Error(
      Array.isArray(message)
        ? message.join('; ')
        : typeof message === 'string'
          ? message
          : `API trả về lỗi HTTP ${response.status}`,
    );
  }

  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new Error('Phản hồi API đặt sân thiếu trường data.');
  }
  return (payload as { data: T }).data;
}

export function getBookingServices(pitchId: number) {
  return request<BookingService[]>(`/services?pitchId=${pitchId}`);
}

export function createBookingHold(input: {
  pitchId: number;
  slotId: number;
  date: string;
  services: Array<{ serviceId: number; quantity: number }>;
}) {
  return request<CurrentBooking>('/holds', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function cancelBookingHold(bookingId: number) {
  return request<{ bookingId: number; status: string }>(`/${bookingId}/hold`, {
    method: 'DELETE',
  });
}

export function getBooking(bookingId: number) {
  return request<CurrentBooking>(`/${bookingId}`);
}
