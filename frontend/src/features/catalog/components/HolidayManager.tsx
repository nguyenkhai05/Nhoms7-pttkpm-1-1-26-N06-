import { useEffect, useState, type FormEvent } from "react";
import { useApp } from "../../../lib/AppContext";
import { catalogApi } from "../api";
import type { Holiday } from "../types";
import "../catalog.css";

// Kết quả của một lần tải danh sách, gắn với số lần tải (version) đã tạo ra nó.
interface Loaded {
  version: number;
  holidays: Holiday[];
  error: string;
}

/** "2026-09-02" thành "02/09/2026". Cắt chuỗi thay vì dùng Date để không bị lệch múi giờ. */
function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export default function HolidayManager() {
  const { setNotice } = useApp();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0); // tăng lên để tải lại danh sách
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const ready = loaded !== null && loaded.version === version ? loaded : null;
  const loading = ready === null;
  const holidays = ready?.holidays ?? [];
  const error = ready?.error ?? "";

  useEffect(() => {
    const controller = new AbortController();
    catalogApi<Holiday[]>("/holidays", { signal: controller.signal })
      .then((list) => setLoaded({ version, holidays: list, error: "" }))
      .catch((cause) => {
        if (cause.name === "AbortError") return;
        setLoaded({
          version,
          holidays: [],
          error: cause instanceof Error ? cause.message : "Không tải được danh sách ngày lễ.",
        });
      });
    return () => controller.abort();
  }, [version]);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget; // giữ lại vì sau await React đã đặt currentTarget về null
    const body = Object.fromEntries(new FormData(form));
    setSaving(true);
    setFormError("");
    try {
      const saved = await catalogApi<Holiday>("/holidays", { method: "POST", body });
      form.reset();
      setNotice(`Đã thêm ngày lễ "${saved.name}" (${formatDate(saved.date)}).`);
      setVersion((v) => v + 1);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Không thêm được ngày lễ.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(holiday: Holiday) {
    if (!window.confirm(`Xóa ngày lễ "${holiday.name}" (${formatDate(holiday.date)})?`)) return;
    try {
      await catalogApi("/holidays/" + holiday.date, { method: "DELETE" });
      setNotice(`Đã xóa ngày lễ "${holiday.name}".`);
      setVersion((v) => v + 1);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Không xóa được ngày lễ.");
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Ngày lễ {loading ? "" : `· ${holidays.length}`}</h2>
          <p className="muted">
            Ngày nằm trong danh sách này được tính theo bảng giá "Ngày lễ" thay cho giá ngày thường
            hoặc cuối tuần. Sân cần có bảng giá "Ngày lễ" thì mới đặt được vào ngày đó.
          </p>
        </div>
      </div>
      <form className="catalog-inline-form" onSubmit={(event) => void add(event)}>
        <label>
          Ngày *
          <input type="date" name="date" required />
        </label>
        <label className="grow">
          Tên ngày lễ *
          <input name="name" required maxLength={150} />
        </label>
        <button className="primary" disabled={saving}>
          {saving ? "Đang lưu…" : "+ Thêm ngày lễ"}
        </button>
      </form>
      {formError && (
        <p className="catalog-error" role="alert">
          {formError}
        </p>
      )}
      {error && (
        <p className="catalog-error" role="alert">
          Không tải được danh sách: {error}
        </p>
      )}
      {loading ? (
        <p>Đang tải…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Tên ngày lễ</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((holiday) => (
                <tr key={holiday.date}>
                  <td>
                    <b>{formatDate(holiday.date)}</b>
                  </td>
                  <td>{holiday.name}</td>
                  <td>
                    <div className="catalog-row-actions">
                      <button className="outline danger" onClick={() => void remove(holiday)}>
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {holidays.length === 0 && !error && (
                <tr>
                  <td colSpan={3}>Chưa có ngày lễ nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}