import { useApp } from "../lib/AppContext";
import PageHead from "../components/PageHead";
import DemoBanner from "../components/DemoBanner";
import { demoPitches } from "../mocks/demoData";

export default function AdminSchedulePage() {
  const { date, setDate, navigate } = useApp();
  return (
    <>
      <PageHead
        tag="QUẢN TRỊ · BẢN MẪU"
        title="Ma trận lịch sân"
        subtitle="Tổng quan các ca theo sân và ngày được chọn."
      />
      <DemoBanner>
        Ma trận quản trị là dữ liệu minh họa. Lịch trống của một sân từ API
        UC1.2 nằm trong trang chi tiết sân.
      </DemoBanner>
      <section className="panel">
        <div className="panel-head">
          <h2>Lịch theo ca</h2>
          <label className="date-label">
            Ngày{" "}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <div className="legend">
          <span>
            <i className="dot green" /> Trống
          </span>
          <span>
            <i className="dot yellow" /> Giữ tạm
          </span>
          <span>
            <i className="dot red" /> Đã cọc / không khả dụng
          </span>
        </div>
        <div className="table-wrap">
          <table className="matrix-table">
            <thead>
              <tr>
                <th>Sân bóng</th>
                {["06:00", "07:30", "16:00", "17:30", "19:00", "20:30"].map(
                  (t) => (
                    <th key={t}>{t}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {demoPitches.map((p, i) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.name}</b>
                    <small>{p.type} người</small>
                  </td>
                  {[0, 1, 2, 3, 4, 5].map((n) => {
                    const color =
                      i === 2
                        ? "red"
                        : n === (i + 3) % 6
                          ? "red"
                          : n === (i + 4) % 6
                            ? "yellow"
                            : "green";
                    return (
                      <td key={n}>
                        <span className={"slot-pill " + color}>
                          {color === "green"
                            ? "Trống"
                            : color === "yellow"
                              ? "Giữ tạm"
                              : "Đã cọc"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="text-button" onClick={() => navigate("search")}>
          Xem lịch từ API theo sân →
        </button>
      </section>
    </>
  );
}
