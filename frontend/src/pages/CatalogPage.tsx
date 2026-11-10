import { useState } from "react";
import PageHead from "../components/PageHead";
import ComplexManager from "../features/catalog/components/ComplexManager";
import PitchManager from "../features/catalog/components/PitchManager";
import PriceManager from "../features/catalog/components/PriceManager";

export default function CatalogPage() {
  const [complexVersion, setComplexVersion] = useState(0);
  const [pitchVersion, setPitchVersion] = useState(0);
  return (
    <>
      <PageHead
        tag="QUẢN TRỊ"
        title="Danh mục sân & bảng giá"
        subtitle="Quản lý cụm sân, sân bóng và cấu hình giá linh hoạt."
      />
      <ComplexManager onChanged={() => setComplexVersion((value) => value + 1)} />
      <PitchManager refreshKey={complexVersion} onChanged={() => setPitchVersion((value) => value + 1)} />
      <PriceManager refreshKey={`${complexVersion}:${pitchVersion}`} />
    </>
  );
}
