import { useEffect, useState, type FormEvent } from "react";
import { catalogApi } from "../api";
import type { CatalogPitch, CatalogPrice, PriceDayType } from "../types";
import "../catalog.css";

const DAY_LABELS: Record<PriceDayType, string> = {
  WEEKDAY: "Ngày thường",
  WEEKEND: "Cuối tuần",
  HOLIDAY: "Ngày lễ",
};
const money = (amount: number) => `${Number(amount).toLocaleString("vi-VN")} đ`;

export default function PriceManager({ refreshKey }: { refreshKey: string }) {
  const [prices, setPrices] = useState<CatalogPrice[]>([]);
  const [pitches, setPitches] = useState<CatalogPitch[]>([]);
  const [editing, setEditing] = useState<CatalogPrice | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([
      catalogApi<CatalogPrice[]>("/prices", { signal: controller.signal }),
      catalogApi<CatalogPitch[]>("/pitches", { signal: controller.signal }),
    ])
      .then(([priceRows, pitchRows]) => {
        setPrices(priceRows);
        setPitches(pitchRows);
        setError("");
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Không tải được bảng giá.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [version, refreshKey]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      pitchId: Number(form.get("pitchId")),
      dayType: form.get("dayType"),
      start: form.get("start"),
      end: form.get("end"),
      amount: Number(form.get("amount")),
      depositPercent: Number(form.get("depositPercent")),
    };
    setSaving(true);
    setError("");
    try {
      await catalogApi<CatalogPrice>(editing ? `/prices/${editing.id}` : "/prices", {
        method: editing ? "PATCH" : "POST",
        body,
      });
      setShowForm(false);
      setEditing(null);
      setVersion((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được bảng giá.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(price: CatalogPrice) {
    if (!window.confirm(`Xóa bảng giá ${price.pitchName} (${DAY_LABELS[price.dayType]})?`)) return;
    try {
      await catalogApi(`/prices/${price.id}`, { method: "DELETE" });
      setVersion((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không xóa được bảng giá.");
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Cấu hình bảng giá {loading ? "" : `· ${prices.length}`}</h2>
          <p className="muted">Thiết lập giá theo loại ngày, khung giờ và tỷ lệ đặt cọc cho từng sân.</p>
        </div>
        <button className="outline" disabled={loading || pitches.length === 0} onClick={() => { setEditing(null); setShowForm(true); }}>
          + Thêm bảng giá
        </button>
      </div>
      {error && <p className="catalog-error" role="alert">{error}</p>}
      {loading ? <p>Đang tải…</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Cụm sân / Sân</th><th>Loại ngày</th><th>Khung giờ</th><th>Giá/ca</th><th>Tiền cọc</th><th>Thao tác</th></tr></thead>
            <tbody>
              {prices.map((price) => (
                <tr key={price.id}>
                  <td><b>{price.pitchName}</b><br /><small>{price.complexName}</small></td>
                  <td>{DAY_LABELS[price.dayType]}</td>
                  <td>{price.start} – {price.end}</td>
                  <td><b>{money(price.amount)}</b></td>
                  <td>{price.depositPercent}%</td>
                  <td><div className="catalog-row-actions">
                    <button className="outline" onClick={() => { setEditing(price); setShowForm(true); }}>Sửa</button>
                    <button className="outline danger" onClick={() => void remove(price)}>Xóa</button>
                  </div></td>
                </tr>
              ))}
              {prices.length === 0 && <tr><td colSpan={6}>Chưa có cấu hình bảng giá nào.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {showForm && (
        <form className="catalog-form" onSubmit={(event) => void submit(event)}>
          <h3>{editing ? `Sửa bảng giá #${editing.id}` : "Thêm bảng giá"}</h3>
          <div className="form-grid">
            <label>Sân *<select name="pitchId" required defaultValue={editing?.pitchId ?? pitches[0]?.id}>{pitches.map((pitch) => <option key={pitch.id} value={pitch.id}>{pitch.complexName} – {pitch.name}</option>)}</select></label>
            <label>Loại ngày *<select name="dayType" defaultValue={editing?.dayType ?? "WEEKDAY"}><option value="WEEKDAY">Ngày thường</option><option value="WEEKEND">Cuối tuần</option><option value="HOLIDAY">Ngày lễ</option></select></label>
            <label>Giờ bắt đầu *<input type="time" name="start" required defaultValue={editing?.start ?? "06:00"} /></label>
            <label>Giờ kết thúc *<input type="time" name="end" required defaultValue={editing?.end ?? "22:00"} /></label>
            <label>Giá thuê (VNĐ) *<input type="number" name="amount" min="1" step="1000" required defaultValue={editing?.amount ?? ""} /></label>
            <label>Tiền cọc (%) *<input type="number" name="depositPercent" min="1" max="100" required defaultValue={editing?.depositPercent ?? 30} /></label>
          </div>
          <p className="muted">Không thể tạo hai bảng giá cùng sân, cùng loại ngày có khung giờ chồng lấn.</p>
          <div className="catalog-actions">
            <button className="primary" disabled={saving}>{saving ? "Đang lưu…" : "Lưu bảng giá"}</button>
            <button type="button" className="outline" disabled={saving} onClick={() => { setShowForm(false); setEditing(null); }}>Hủy</button>
          </div>
        </form>
      )}
    </section>
  );
}
