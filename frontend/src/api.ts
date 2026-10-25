/** API UC1.2: search, pitch detail and daily schedule. */
export async function api<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try { response = await fetch('/api/pitches' + path, { signal }); }
  catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new Error('Không kết nối được backend ở cổng 3000');
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload && typeof payload === 'object' && 'message' in payload ? payload.message : null;
    throw new Error(Array.isArray(error) ? error.join('; ') : typeof error === 'string' ? error : `API trả về lỗi HTTP ${response.status}`);
  }
  if (!payload || typeof payload !== 'object' || !('data' in payload)) throw new Error('Phản hồi API thiếu trường data');
  return (payload as { data: T }).data;
}
