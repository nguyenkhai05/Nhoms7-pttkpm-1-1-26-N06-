import { useApp } from "../lib/AppContext";
import PageHead from "../components/PageHead";
import DemoBanner from "../components/DemoBanner";
import Metric from "../components/Metric";
import { demoPitches } from "../mocks/demoData";
import { money } from "../lib/format";

export default function CatalogPage() {
  const { setNotice } = useApp();
  return (
    <>
      <PageHead
        tag="QUẢN TRỊ · BẢN MẪU"
        title="Danh mục sân & bảng giá"
        subtitle="Bố cục quản lý sân và cấu hình giá linh hoạt."
      />
      <DemoBanner>
        Dữ liệu bên dưới là minh họa. Thao tác thêm, sửa, xóa cần API quản trị
        và phân quyền.
      </DemoBanner>
      <div className="metric-grid">
        <Metric name="Cụm sân" value="02" icon="◎" />
        <Metric name="Tổng số sân" value="03" icon="⚽" />
        <Metric name="Sân đang hoạt động" value="02" icon="●" />
        <Metric name="Quy tắc giá" value="06" icon="▤" />
      </div>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Danh sách sân</h2>
            <p className="muted">
              Thông tin minh họa theo cấu trúc dữ liệu hiện tại.
            </p>
          </div>
          <button
            className="outline"
            onClick={() =>
              setNotice(
                "Biểu mẫu thêm sân sẽ được nối API ở issue quản lý danh mục.",
              )
            }
          >
            + Thêm sân
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sân bóng</th>
                <th>Cụm sân</th>
                <th>Loại</th>
                <th>Giá từ</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {demoPitches.map((p, i) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.name}</b>
                  </td>
                  <td>{p.complexName}</td>
                  <td>{p.type} người</td>
                  <td>{money(p.startingPrice)}</td>
                  <td>
                    <span className={"badge " + (i === 2 ? "amber" : "green")}>
                      {i === 2 ? "Bảo trì (mẫu)" : "Hoạt động"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Cấu hình bảng giá</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sân</th>
                <th>Loại ngày</th>
                <th>Khung giờ</th>
                <th>Giá/ca</th>
              </tr>
            </thead>
            <tbody>
              {demoPitches.flatMap((p) =>
                p.prices.map((r) => (
                  <tr key={r.id}>
                    <td>{p.name}</td>
                    <td>
                      {r.dayType === "WEEKDAY" ? "Ngày thường" : "Cuối tuần"}
                    </td>
                    <td>
                      {r.start} – {r.end}
                    </td>
                    <td>
                      <b>{money(r.amount)}</b>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
