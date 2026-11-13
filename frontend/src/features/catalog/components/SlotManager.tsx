import { useEffect, useState, type FormEvent } from "react";
import { useApp } from "../../../lib/AppContext";
import { catalogApi } from "../api";
import { DAY_TYPE_LABELS, type CatalogPitch, type CatalogSlot } from "../types";
import "../catalog.css";

// Kết quả của một lần tải, gắn với khóa (key) của lần tải đã tạo ra nó.
interface PitchesLoaded {
  key: string;
  pitches: CatalogPitch[];
  error: string;
}
interface SlotsLoaded {
  key: string;
  slots: CatalogSlot[];
  error: string;
}

/** refreshKey đổi khi cụm sân hoặc sân thay đổi. Sau khi sửa bảng giá, bấm "Làm mới" để cập nhật cột Giá. */
export default function SlotManager({ refreshKey }: { refreshKey: string }) {
  const { setNotice } = useApp();
  const [pitchesLoaded, setPitchesLoaded] = useState<PitchesLoaded | null>(null);
  const [slotsLoaded, setSlotsLoaded] = useState<SlotsLoaded | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [version, setVersion] = useState(0); // tăng lên để tải lại sau khi thêm, xóa hoặc bấm Làm mới
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const pitchKey = `${refreshKey}:${version}`;
  const pitchesReady = pitchesLoaded !== null && pitchesLoaded.key === pitchKey ? pitchesLoaded : null;
  const pitches = pitchesReady?.pitches ?? [];
  // Sân đang chọn: lựa chọn của người dùng nếu còn tồn tại, ngược lại là sân đầu tiên.
  const pitchId = pitches.some((pitch) => pitch.id === chosen) ? chosen : (pitches[0]?.id ?? null);
  const slotKey = `${pitchKey}:${pitchId}`;
  const slotsReady =
    pitchId !== null && slotsLoaded !== null && slotsLoaded.key === slotKey ? slotsLoaded : null;
  const loading = pitchesReady === null || (pitchId !== null && slotsReady === null);
  const slots = slotsReady?.slots ?? [];
  const error = pitchesReady?.error || slotsReady?.error || "";

  useEffect(() => {
    const controller = new AbortController();
    catalogApi<CatalogPitch[]>("/pitches", { signal: controller.signal })
      .then((list) => setPitchesLoaded({ key: pitchKey, pitches: list, error: "" }))
      .catch((cause) => {
        if (cause.name === "AbortError") return;
        setPitchesLoaded({
          key: pitchKey,
          pitches: [],
          error: cause instanceof Error ? cause.message : "Không tải được danh sách sân.",
        });
      });
    return () => controller.abort();
  }, [pitchKey]);

  useEffect(() => {
    if (pitchId === null) return;
    const controller = new AbortController();
    catalogApi<CatalogSlot[]>(`/pitches/${pitchId}/slots`, { signal: controller.signal })
      .then((list) => setSlotsLoaded({ key: slotKey, slots: list, error: "" }))
      .catch((cause) => {
        if (cause.name === "AbortError") return;
        setSlotsLoaded({
          key: slotKey,
          slots: [],
          error: cause instanceof Error ? cause.message : "Không tải được danh sách ca giờ.",
        });
      });
    return () => controller.abort();
  }, [pitchId, slotKey]);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pitchId === null) return;
    const form = event.currentTarget; // giữ lại vì sau await React đã đặt currentTarget về null
    const body = Object.fromEntries(new FormData(form));
    setSaving(true);
    setFormError("");
    try {
      const saved = await catalogApi<CatalogSlot>(`/pitches/${pitchId}/slots`, { method: "POST", body });
      form.reset();
      const missing = saved.uncoveredDayTypes.map((day) => DAY_TYPE_LABELS[day]).join(", ");
      setNotice(
        missing
          ? `Đã thêm ca ${saved.start} – ${saved.end}, nhưng chưa có giá cho: ${missing}.`
          : `Đã thêm ca ${saved.start} – ${saved.end}.`,
      );
      setVersion((v) => v + 1);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Không thêm được ca giờ.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(slot: CatalogSlot) {
    if (!window.confirm(`Xóa ca ${slot.start} – ${slot.end}?`)) return;
    try {
      await catalogApi(`/pitches/${slot.pitchId}/slots/${slot.id}`, { method: "DELETE" });
      setNotice(`Đã xóa ca ${slot.start} – ${slot.end}.`);
      setVersion((v) => v + 1);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Không xóa được ca giờ.");
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Ca giờ {loading || pitchId === null ? "" : `· ${slots.length}`}</h2>
          <p className="muted">
            Ca phải nằm trọn trong đúng một khung giá của sân thì mới đặt được. Ca có nhãn "Thiếu giá"
            sẽ báo lỗi khi khách đặt vào loại ngày đó.
          </p>
        </div>
        <button className="outline" onClick={() => setVersion((v) => v + 1)} disabled={loading}>
          Làm mới
        </button>
      </div>
      <div className="catalog-inline-form">
        <label className="grow">
          Sân
          <select
            value={pitchId ?? ""}
            onChange={(event) => setChosen(Number(event.target.value))}
            disabled={pitches.length === 0}
          >
            {pitches.map((pitch) => (
              <option key={pitch.id} value={pitch.id}>
                {pitch.complexName} – {pitch.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p className="catalog-error" role="alert">
          Không tải được dữ liệu: {error}
        </p>
      )}
      {!loading && pitchId === null && !error && <p>Chưa có sân nào để cấu hình ca giờ.</p>}
      {pitchId !== null && (
        <form className="catalog-inline-form" onSubmit={(event) => void add(event)}>
          <label>
            Giờ bắt đầu *
            <input type="time" name="start" required defaultValue="06:00" />
          </label>
          <label>
            Giờ kết thúc *
            <input type="time" name="end" required defaultValue="07:30" />
          </label>
          <button className="primary" disabled={saving || loading}>
            {saving ? "Đang lưu…" : "+ Thêm ca"}
          </button>
        </form>
      )}
      {formError && (
        <p className="catalog-error" role="alert">
          {formError}
        </p>
      )}
      {loading && pitchId !== null && <p>Đang tải…</p>}
      {pitchesReady === null && pitchId === null && <p>Đang tải…</p>}
      {!loading && pitchId !== null && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ca giờ</th>
                <th>Giá</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot.id}>
                  <td>
                    <b>
                      {slot.start} – {slot.end}
                    </b>
                  </td>
                  <td>
                    {slot.uncoveredDayTypes.length === 0 ? (
                      <span className="badge green">Đã có giá</span>
                    ) : (
                      <span className="badge amber">
                        Thiếu giá: {slot.uncoveredDayTypes.map((day) => DAY_TYPE_LABELS[day]).join(", ")}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="catalog-row-actions">
                      <button className="outline danger" onClick={() => void remove(slot)}>
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {slots.length === 0 && !error && (
                <tr>
                  <td colSpan={3}>Sân này chưa có ca giờ nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}