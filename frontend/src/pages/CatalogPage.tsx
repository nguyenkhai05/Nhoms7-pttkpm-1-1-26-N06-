import { useState } from "react";
import PageHead from "../components/PageHead";
import DemoBanner from "../components/DemoBanner";
import ComplexManager from "../features/catalog/components/ComplexManager";
import PitchManager from "../features/catalog/components/PitchManager";
import { demoPitches } from "../mocks/demoData";
import { money } from "../lib/format";

export default function CatalogPage() {
  // Tăng lên mỗi khi cụm sân đổi, để danh sách cụm trong biểu mẫu thêm sân luôn mới.
  const [complexVersion, setComplexVersion] = useState(0);
  return (
    <>
      <PageHead
        tag="QUẢN TRỊ"
        title="Danh mục sân & bảng giá"
        subtitle="Quản lý cụm sân, sân bóng và cấu hình giá linh hoạt."
      />
      <ComplexManager onChanged={() => setComplexVersion((v) => v + 1)} />
      <PitchManager refreshKey={complexVersion} />
      <DemoBanner>
        Bảng giá bên dưới vẫn là dữ liệu minh họa, sẽ nối API khi phần backend
        bảng giá hoàn thành.
      </DemoBanner>
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