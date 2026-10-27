import { useState, type FormEvent } from "react";
import { catalogApi } from "../api";
import type { Complex } from "../types";
import "../catalog.css";

export default function ComplexForm({
  complex,
  onSaved,
  onCancel,
}: {
  complex: Complex | null;
  onSaved: (saved: Complex) => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true);
    setError("");
    try {
      const saved = await catalogApi<Complex>(
        complex ? "/complexes/" + complex.id : "/complexes",
        { method: complex ? "PATCH" : "POST", body },
      );
      onSaved(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được cụm sân.");
      setSaving(false);
    }
  }

  return (
    <form className="catalog-form" onSubmit={(event) => void submit(event)}>
      <h3>{complex ? `Sửa cụm sân #${complex.id}` : "Thêm cụm sân mới"}</h3>
      <div className="form-grid">
        <label>
          Tên cụm sân *
          <input name="name" required maxLength={150} defaultValue={complex?.name ?? ""} />
        </label>
        <label>
          Quận/huyện *
          <input name="district" required maxLength={100} defaultValue={complex?.district ?? ""} />
        </label>
        <label className="full-row">
          Địa chỉ *
          <input name="address" required maxLength={255} defaultValue={complex?.address ?? ""} />
        </label>
        <label>
          Liên hệ
          <input name="contact" maxLength={60} defaultValue={complex?.contact ?? ""} />
        </label>
        <label>
          Ảnh (đường dẫn URL)
          <input name="image" maxLength={1000} defaultValue={complex?.image ?? ""} />
        </label>
        <label className="full-row">
          Mô tả
          <textarea name="description" rows={3} defaultValue={complex?.description ?? ""} />
        </label>
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