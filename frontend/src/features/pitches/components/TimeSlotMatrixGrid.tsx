import type { Selection, Matrix } from "../types";
import { useEffect, useState } from "react";
import { api } from "../api";

export default function TimeSlotMatrixGrid({
  pitchId,
  onSelect,
}: {
  pitchId: number;
  onSelect: (selection: Selection) => void;
}) {
  const [date, setDate] = useState(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
      new Date(Date.now() + 86400000),
    ),
  );
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [error, setError] = useState("");
  const [choosing, setChoosing] = useState(false);
  useEffect(() => {
    if (!date) {
      setMatrix(null);
      return;
    }
    const controller = new AbortController();
    setMatrix(null);
    setError("");
    const load = () =>
      api<Matrix>(
        "/" + pitchId + "/schedule?date=" + encodeURIComponent(date),
        controller.signal,
      )
        .then((result) => {
          setMatrix(result);
          setError("");
        })
        .catch((cause) => {
          if (cause.name !== "AbortError") {
            setError(
              cause instanceof Error
                ? cause.message
                : "Không tải được lịch sân.",
            );
            setMatrix(null);
          }
        });
    void load();
    const timer = setInterval(load, 3000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [pitchId, date]);
  async function choose(slotId: number) {
    setChoosing(true);
    setError("");
    try {
      const fresh = await api<Matrix>(
        "/" + pitchId + "/schedule?date=" + encodeURIComponent(date),
      );
      setMatrix(fresh);
      if (fresh.slots.find((slot) => slot.id === slotId)?.status !== "GREEN") {
        setError("Ca vừa thay đổi, vui lòng chọn ca khác.");
        return;
      }
      onSelect({ pitchId, date, slotId });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không tải được lịch sân.",
      );
    } finally {
      setChoosing(false);
    }
  }
  return (
    <div>
      <h2>Lịch trống theo ngày</h2>
      <input
        aria-label="Ngày đá"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <div className="legend">
        <span>
          <i className="dot green" /> Xanh · trống
        </span>
        <span>
          <i className="dot yellow" /> Vàng · giữ tạm
        </span>
        <span>
          <i className="dot red" /> Đỏ · đã cọc/không khả dụng
        </span>
      </div>
      {error && (
        <p role="alert" className="demo-banner">
          Không tải được lịch: {error}
        </p>
      )}
      {!matrix && !error && <p>Đang tải lịch…</p>}
      <div className="slots">
        {matrix?.slots.map((slot) => (
          <button
            key={slot.id}
            className={slot.status}
            disabled={slot.status !== "GREEN" || choosing}
            onClick={() => void choose(slot.id)}
          >
            {slot.start} – {slot.end}
            <br />
            <b>
              {slot.price === null
                ? "Chưa có giá"
                : slot.price.toLocaleString("vi-VN") + " đ"}
            </b>
            <br />
            {slot.status === "GREEN"
              ? "Trống · chọn ca"
              : slot.status === "YELLOW"
                ? "Đang giữ"
                : "Không khả dụng"}
          </button>
        ))}
      </div>
      {matrix && matrix.slots.every((slot) => slot.status !== "GREEN") && (
        <p>Ngày này không còn ca trống. Hãy chọn ngày khác.</p>
      )}
      <small className="muted">
        Dữ liệu API làm mới mỗi 3 giây. Chọn ca chưa giữ chỗ và chưa tạo đơn.
      </small>
    </div>
  );
}
