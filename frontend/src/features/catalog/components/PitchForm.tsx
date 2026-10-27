import { useState, type FormEvent } from "react";
import { catalogApi } from "../api";
import {
  PITCH_STATUSES,
  PITCH_TYPES,
  STATUS_LABELS,
  type Amenity,
  type CatalogPitch,
  type Complex,
} from "../types";
import "../catalog.css";

export default function PitchForm({
  pitch,
  complexes,
  amenities,
  onSaved,
  onCancel,
}: {
  pitch: CatalogPitch | null;
  complexes: Complex[];
  amenities: Amenity[];
  onSaved: (saved: CatalogPitch) => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      complexId: form.get("complexId"),
      name: form.get("name"),
      type: form.get("type"),
      status: form.get("status"),
      grass: form.get("grass"),
      lights: form.get("lights"),
      image: form.get("image"),
      amenityIds: form.getAll("amenityIds"),
    };
    setSaving(true);
    setError("");
    try {
      const saved = await catalogApi<CatalogPitch>(
        pitch ? "/pitches/" + pitch.id : "/pitches",
        { method: pitch ? "PATCH" : "POST", body },
      );
      onSaved(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được sân.");
      setSaving(false);
    }
  }

  return (
    <form className="catalog-form" onSubmit={(event) => void submit(event)}>
      <h3>{pitch ? `Sửa sân #${pitch.id}` : "Thêm sân mới"}</h3>
      <div className="form-grid">
        <label>
          Cụm sân *
          <select name="complexId" required defaultValue={pitch?.complexId ?? complexes[0]?.id}>
            {complexes.map((complex) => (
              <option key={complex.id} value={complex.id}>
                {complex.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tên sân *
          <input name="name" required maxLength={100} defaultValue={pitch?.name ?? ""} />
        </label>
        <label>
          Loại sân *
          <select name="type" required defaultValue={pitch?.type ?? 7}>
            {PITCH_TYPES.map((type) => (
              <option key={type} value={type}>
                Sân {type} người
              </option>
            ))}
          </select>
        </label>
        <label>
          Trạng thái *
          <select name="status" required defaultValue={pitch?.status ?? "ACTIVE"}>
            {PITCH_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Loại cỏ
          <input name="grass" maxLength={150} defaultValue={pitch?.grass ?? ""} />
        </label>
        <label>
          Hệ thống đèn
          <input name="lights" maxLength={150} defaultValue={pitch?.lights ?? ""} />
        </label>
        <label className="full-row">
          Ảnh (đường dẫn URL)
          <input name="image" maxLength={1000} defaultValue={pitch?.image ?? ""} />
        </label>
        <fieldset className="full-row catalog-fieldset">
          <legend>Tiện ích</legend>
          <div className="catalog-checks">
            {amenities.map((amenity) => (
              <label key={amenity.id}>
                <input
                  type="checkbox"
                  name="amenityIds"
                  value={amenity.id}
                  defaultChecked={pitch?.amenityIds.includes(amenity.id)}
                />
                {amenity.name}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      {error && (
        <p className="catalog-error" role="alert">
          {error}
        </p>
      )}
      <div className="catalog-actions">
        <button className="primary" disabled={saving}>
          {saving ? "Đang lưu…" : "Lưu"}
        </button>
        <button type="button" className="outline" disabled={saving} onClick={onCancel}>
          Hủy
        </button>
      </div>
    </form>
  );
}