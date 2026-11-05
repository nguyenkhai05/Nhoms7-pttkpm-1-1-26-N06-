import { useEffect, useState } from "react";
import { api } from "../api";
import type { Amenity } from "../types";

export default function PitchFilterBar({
  onSearch,
}: {
  onSearch: (q: Record<string, string>) => void;
}) {
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [amenityError, setAmenityError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    api<Amenity[]>("/amenities", controller.signal)
      .then(setAmenities)
      .catch((cause) => {
        if (cause.name !== "AbortError") {
          setAmenityError(
            cause instanceof Error ? cause.message : "Không tải được danh sách tiện ích.",
          );
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const filters: Record<string, string> = {};
        for (const key of ["type", "district", "minPrice", "maxPrice"]) {
          const value = String(form.get(key) ?? "").trim();
          if (value) filters[key] = value;
        }
        const selectedAmenities = form.getAll("amenities").map(String);
        if (selectedAmenities.length) filters.amenities = selectedAmenities.join(",");
        onSearch(filters);
      }}
    >
      <select name="type" defaultValue="">
        <option value="">Mọi loại sân</option>
        {[5, 7, 11].map((type) => (
          <option key={type} value={type}>
            Sân {type} người
          </option>
        ))}
      </select>
      <input name="district" placeholder="Quận/huyện" maxLength={100} />
      <input name="minPrice" type="number" min="0" step="1" placeholder="Giá từ" />
      <input name="maxPrice" type="number" min="0" step="1" placeholder="Giá đến" />
      <fieldset>
        <legend>Tiện ích</legend>
        {amenityError ? (
          <small role="alert">{amenityError}</small>
        ) : amenities.length ? (
          <div className="catalog-checks">
            {amenities.map((amenity) => (
              <label key={amenity.id}>
                <input type="checkbox" name="amenities" value={amenity.id} />
                {amenity.name}
              </label>
            ))}
          </div>
        ) : (
          <small>Đang tải tiện ích…</small>
        )}
      </fieldset>
      <button type="submit">Tìm sân</button>
      <button
        type="reset"
        onClick={() => onSearch({})}
      >
        Xóa bộ lọc
      </button>
    </form>
  );
}
