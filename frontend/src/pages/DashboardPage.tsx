import PageHead from "../components/PageHead";
import DemoBanner from "../components/DemoBanner";
import Metric from "../components/Metric";

export default function DashboardPage() {
  return (
    <>
      <PageHead
        tag="QUẢN TRỊ · BẢN MẪU"
        title="Báo cáo tổng quan"
        subtitle="Bố cục thống kê vận hành dành cho quản trị viên."
      />
      <DemoBanner>
        Các số liệu và biểu đồ chỉ minh họa. Cần API báo cáo để hiển thị dữ liệu
        thực.
      </DemoBanner>
      <div className="metric-grid">
        <Metric name="Doanh thu trong ngày" value="3,2 triệu" icon="₫" />
        <Metric name="Lượt đặt sân" value="18" icon="▣" />
        <Metric name="Tỷ lệ lấp đầy" value="76%" icon="◕" />
        <Metric name="Đơn chờ cọc" value="04" icon="◷" />
      </div>
      <div className="two-columns">
        <section className="panel">
          <h2>Doanh thu 7 ngày · minh họa</h2>
          <div
            className="chart"
            role="img"
            aria-label="Biểu đồ minh họa doanh thu bảy ngày"
          >
            <div className="chart-bars">
              {[43, 64, 52, 82, 68, 95, 73].map((h, i) => (
                <div key={i}>
                  <span style={{ height: h + "%" }} />
                  <small>{["T2", "T3", "T4", "T5", "T6", "T7", "CN"][i]}</small>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="panel">
          <h2>Hoạt động gần đây · minh họa</h2>
          <div className="activity">
            <span>●</span>
            <div>
              <b>Đơn đặt sân mới</b>
              <small>Sân A1 · Ca 17:30 – 19:00</small>
            </div>
            <em>09:42</em>
          </div>
          <div className="activity">
            <span>●</span>
            <div>
              <b>Thanh toán cọc</b>
              <small>Sân B2 · Đang chờ xác nhận</small>
            </div>
            <em>09:25</em>
          </div>
          <div className="activity">
            <span>●</span>
            <div>
              <b>Cập nhật bảng giá</b>
              <small>Ngày cuối tuần · Sân A1</small>
            </div>
            <em>Hôm qua</em>
          </div>
        </section>
      </div>
    </>
  );
}
