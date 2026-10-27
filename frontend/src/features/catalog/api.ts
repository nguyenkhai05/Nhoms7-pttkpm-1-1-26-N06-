/** API quản lý danh mục sân và bảng giá: /api/catalog/... */
interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export async function catalogApi<T>(
  path: string,
  { method = "GET", body, signal }: RequestOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api/catalog" + path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new Error("Không kết nối được backend ở cổng 3000");
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? payload.message
        : null;
    throw new Error(
      Array.isArray(message)
        ? message.join("; ")
        : typeof message === "string"
          ? message
          : `API trả về lỗi HTTP ${response.status}`,
    );
  }
  if (!payload || typeof payload !== "object" || !("data" in payload))
    throw new Error("Phản hồi API thiếu trường data");
  return (payload as { data: T }).data;
}