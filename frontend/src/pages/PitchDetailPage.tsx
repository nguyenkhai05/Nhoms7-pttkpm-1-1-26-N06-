import { useApp } from "../lib/AppContext";
import PageHead from "../components/PageHead";
import PitchDetailView from "../features/pitches/components/PitchDetailPage";

export default function PitchDetailPage() {
  const { pitchId, navigate, select } = useApp();
  return (
    <>
      <PageHead
        tag="CHI TIẾT SÂN"
        title="Thông tin & lịch trống"
        subtitle="Chọn một khung giờ màu xanh để chuyển đến giao diện đặt sân."
      />
      <PitchDetailView
        id={pitchId}
        onBack={() => navigate("search")}
        onSelect={select}
      />
    </>
  );
}
