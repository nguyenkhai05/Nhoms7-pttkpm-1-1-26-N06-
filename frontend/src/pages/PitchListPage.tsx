import { useApp } from "../lib/AppContext";
import PageHead from "../components/PageHead";
import PitchFilterBar from "../features/pitches/components/PitchFilterBar";
import FootballPitchList from "../features/pitches/components/FootballPitchList";

export default function PitchListPage() {
  const { search, error, loading, pitches, setPitchId, navigate } = useApp();
  return (
    <>
      <PageHead
        tag="TÌM KIẾM & KHÁM PHÁ"
        title="Tìm sân bóng"
        subtitle="Lọc sân theo nhu cầu và xem lịch trống từng ca."
      />
      <section className="panel search-panel">
        <PitchFilterBar onSearch={search} />
      </section>
      <div className="list-head">
        <h2>
          Sân bóng {loading ? "· đang tải" : `· ${pitches.length} kết quả`}
        </h2>
        <span className="data-tag">Dữ liệu từ API UC1.2</span>
      </div>
      {error ? (
        <div className="demo-banner" role="alert">
          Không tải được sân: {error}. Kiểm tra backend và MySQL, sau đó bấm Tìm
          sân để thử lại.
        </div>
      ) : loading ? (
        <p>Đang tải danh sách sân…</p>
      ) : (
        <FootballPitchList
          pitches={pitches}
          onOpen={(id) => {
            setPitchId(id);
            navigate("detail", id);
          }}
        />
      )}
    </>
  );
}
