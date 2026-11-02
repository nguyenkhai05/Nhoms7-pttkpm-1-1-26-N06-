import { useEffect, useState } from "react";
import { useApp } from "../../../lib/AppContext";
import { catalogApi } from "../api";
import {
  STATUS_LABELS,
  type Amenity,
  type CatalogPitch,
  type Complex,
  type PitchStatus,
} from "../types";
import PitchForm from "./PitchForm";
import "../catalog.css";

// Kết quả của một lần tải, gắn với khóa (key) của lần tải đã tạo ra nó.
interface Loaded {
  key: string;
  pitches: CatalogPitch[];
  complexes: Complex[];
  amenities: Amenity[];
  error: string;
}

const BADGE: Record<PitchStatus, string> = {
  ACTIVE: "green",
  MAINTENANCE: "amber",
  INACTIVE: "gray",
};

/** refreshKey đổi khi cụm sân thay đổi, để danh sách cụm trong biểu mẫu luôn mới. */
export default function PitchManager({ refreshKey }: { refreshKey: number }) {
  const { setNotice } = useApp();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // null: đóng form · "new": thêm mới · CatalogPitch: đang sửa sân đó
  const [editing, setEditing] = useState<CatalogPitch | "new" | null>(null);
  const [version, setVersion] = useState(0); // tăng lên để tải lại sau khi thêm, sửa, xóa

  const key = `${refreshKey}:${version}`;
  // Chỉ dùng kết quả nếu nó thuộc về lần tải hiện tại; ngược lại coi như đang tải.
  const ready = loaded !== null && loaded.key === key ? loaded : null;
  const loading = ready === null;
  const pitches = ready?.pitches ?? [];
  const complexes = ready?.complexes ?? [];
  const amenities = ready?.amenities ?? [];
  const error = ready?.error ?? "";
  const amenityNames = new Map(amenities.map((amenity) => [amenity.id, amenity.name]));

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    Promise.all([
      catalogApi<CatalogPitch[]>("/pitches", { signal }),
      catalogApi<Complex[]>("/complexes", { signal }),
      catalogApi<Amenity[]>("/amenities", { signal }),
    ])
      .then(([pitchList, complexList, amenityList]) =>
        setLoaded({ key, pitches: pitchList, complexes: complexList, amenities: amenityList, error: "" }),
      )
      .catch((cause) => {
        if (cause.name === "AbortError") return;
        setLoaded({
          key,
          pitches: [],
          complexes: [],
          amenities: [],
          error: cause instanceof Error ? cause.message : "Không tải được danh sách sân.",
        });
      });
    return () => controller.abort();
  }, [key]);

  function startCreate() {
    if (complexes.length === 0) {
      setNotice("Hãy tạo cụm sân trước khi thêm sân.");
      return;
    }
    setEditing("new");
  }

  async function remove(pitch: CatalogPitch) {
    if (!window.confirm(`Xóa sân "${pitch.name}"?`)) return;
    try {
      await catalogApi("/pitches/" + pitch.id, { method: "DELETE" });
      setNotice(`Đã xóa sân "${pitch.name}".`);
      setVersion((v) => v + 1);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Không xóa được sân.");
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Sân bóng {loading ? "" : `· ${pitches.length}`}</h2>
          <p className="muted">
            Gồm cả sân đang bảo trì hoặc ngừng hoạt động. Sân đã có ca hoặc bảng giá không xóa được,
            hãy chuyển sang "Ngừng hoạt động".
          </p>
        </div>
        <button className="outline" onClick={startCreate} disabled={loading}>
          + Thêm sân
        </button>
      </div>
      {error && (
        <p className="catalog-error" role="alert">
          Không tải được danh sách: {error}
        </p>
      )}
      {loading ? (
        <p>Đang tải…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sân bóng</th>
                <th>Cụm sân</th>
                <th>Loại</th>
                <th>Trạng thái</th>
                <th>Tiện ích</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {pitches.map((pitch) => (
                <tr key={pitch.id}>
                  <td>
                    <b>{pitch.name}</b>
                  </td>
                  <td>{pitch.complexName}</td>
                  <td>{pitch.type} người</td>
                  <td>
                    <span className={"badge " + BADGE[pitch.status]}>{STATUS_LABELS[pitch.status]}</span>
                  </td>
                  <td>
                    {pitch.amenityIds
                      .map((id) => amenityNames.get(id))
                      .filter((name) => name !== undefined)
                      .join(", ") || "—"}
                  </td>
                  <td>
                    <div className="catalog-row-actions">
                      <button className="outline" onClick={() => setEditing(pitch)}>
                        Sửa
                      </button>
                      <button className="outline danger" onClick={() => void remove(pitch)}>
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pitches.length === 0 && !error && (
                <tr>
                  <td colSpan={6}>Chưa có sân nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <PitchForm
          key={editing === "new" ? "new" : editing.id}
          pitch={editing === "new" ? null : editing}
          complexes={complexes}
          amenities={amenities}
          onCancel={() => setEditing(null)}
          onSaved={(saved) => {
            setNotice(
              editing === "new"
                ? `Đã thêm sân "${saved.name}".`
                : `Đã cập nhật sân "${saved.name}".`,
            );
            setEditing(null);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </section>
  );
}