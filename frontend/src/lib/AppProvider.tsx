import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppContext, type CurrentBooking } from './AppContext';
import { currentPage, currentPitchId, type Page } from './routes';
import { today } from './format';
import { api } from '../features/pitches/api';
import type { Pitch, Selection } from '../features/pitches/types';
import { getBooking } from '../features/bookings/api';
import { demoPitches } from '../mocks/demoData';

export default function AppProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>(currentPage);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pitchId, setPitchId] = useState(currentPitchId);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [date, setDate] = useState(today());
  const [notice, setNotice] = useState('');
  const [booking, setBookingState] = useState<CurrentBooking | null>(null);
  const setBooking = (next: CurrentBooking | null) => {
    setBookingState(next);
    if (next) sessionStorage.setItem('activeBookingId', String(next.id));
    else sessionStorage.removeItem('activeBookingId');
  };
  const request = useRef<AbortController | null>(null);

  const navigate = (next: Page, id?: number) => {
    location.hash = '/' + next + (next === 'detail' && id ? '?id=' + id : '');
    setPage(next);
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const update = () => {
      setPage(currentPage());
      if (currentPage() === 'detail') setPitchId(currentPitchId());
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  useEffect(() => {
    const storedId = Number(sessionStorage.getItem('activeBookingId'));
    if (!Number.isSafeInteger(storedId) || storedId <= 0 || !localStorage.getItem('accessToken')) return;
    getBooking(storedId)
      .then((restored) => {
        if (sessionStorage.getItem('activeBookingId') === String(storedId)) setBooking(restored);
      })
      .catch(() => {
        if (sessionStorage.getItem('activeBookingId') === String(storedId)) setBooking(null);
      });
  }, []);

  useEffect(() => {
    if (page !== 'search') return;
    search();
    return () => request.current?.abort();
  }, [page]);

  function search(filters: Record<string, string> = {}) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, value]) => value),
    );
    api<Pitch[]>('?' + params, controller.signal)
      .then(setPitches)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setPitches([]);
        setError(cause instanceof Error ? cause.message : 'Không thể tải danh sách sân.');
      })
      .finally(() => {
        if (request.current === controller) setLoading(false);
      });
  }

  function select(value: Selection) {
    setBooking(null);
    setPitchId(value.pitchId);
    setSelection(value);
    setDate(value.date);
    navigate('booking');
  }

  const selectedPitch =
    pitches.find((pitch) => pitch.id === pitchId) ??
    demoPitches.find((pitch) => pitch.id === pitchId) ??
    demoPitches[0];

  const value = {
    page,
    navigate,
    pitches,
    search,
    loading,
    error,
    pitchId,
    setPitchId,
    selection,
    setSelection,
    select,
    selectedPitch,
    date,
    setDate,
    booking,
    setBooking,
    notice,
    setNotice,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
