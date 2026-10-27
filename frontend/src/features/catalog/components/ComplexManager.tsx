import { useEffect, useState } from "react";
import { useApp } from "../../../lib/AppContext";
import { catalogApi } from "../api";
import type { Complex } from "../types";
import ComplexForm from "./ComplexForm";
import "../catalog.css";

// Kết quả của một lần tải danh sách, gắn với số lần tải (version) đã tạo ra nó.
interface Loaded {
  version: number;
  items: Complex[];
  error: string;
}

export default function ComplexManager({ onChanged }: { onChanged?: () => void }) {
  const { setNotice } = useApp();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // null: đóng form · "new": thêm mới · Complex: đang sửa cụm đó
  const [editing, setEditing] = useState<Complex | "new" | null>(null);
  const [version, setVersion] = useState(0); // tăng lên để tải lại danh sách

  // Đang tải khi chưa có kết quả nào, hoặc kết quả đang có là của lần tải trước.
  const loading = loaded === null || loaded.version !== version;
  const items = loading ? [] : loaded.items;
  const error = loading ? "" : loaded.error;

  useEffect(() => {
    const controller = new AbortController();
    catalogApi<Complex[]>("/complexes", { signal: controller.signal })
      .then((result) => setLoaded({ version, items: result, error: "" }))
      .catch((cause) => {
        if (cause.name === "AbortError") return;
        setLoaded({
          version,
          items: [],
          error:
            cause instanceof Error ? cause.message : "Không tải được danh sách cụm sân.",
        });
      });
    return () => controller.abort();
  }, [version]);

  async function remove(item: Complex) {
    if (!window.confirm(`Xóa cụm sân "${item.name}"?`)) return;
    try {
      await catalogApi("/complexes/" + item.id, { method: "DELETE" });
      setNotice(`Đã xóa cụm sân "${item.name}".`);
      setVersion((v) => v + 1);
      onChanged?.();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Không xóa được cụm sân.");
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Cụm sân {loading ? "" : `· ${items.length}`}</h2>
          <p className="muted">Dữ liệu từ API quản lý danh mục.</p>
        </div>
        <button className="outline" onClick={() => setEditing("new")}>
          + Thêm cụm sân
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
                <th>Tên cụm sân</th>
                <th>Quận/huyện</th>
                <th>Địa chỉ</th>
                <th>Liên hệ</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <b>{item.name}</b>
                  </td>
                  <td>{item.district}</td>
                  <td>{item.address}</td>
                  <td>{item.contact ?? "—"}</td>
                  <td>
                    <div className="catalog-row-actions">
                      <button className="outline" onClick={() => setEditing(item)}>
                        Sửa
                      </button>
                      <button className="outline danger" onClick={() => void remove(item)}>
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !error && (
                <tr>
                  <td colSpan={5}>Chưa có cụm sân nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <ComplexForm
          key={editing === "new" ? "new" : editing.id}
          complex={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={(saved) => {
            setNotice(
              editing === "new"
                ? `Đã thêm cụm sân "${saved.name}".`
                : `Đã cập nhật cụm sân "${saved.name}".`,
            );
            setEditing(null);
            setVersion((v) => v + 1);
            onChanged?.();
          }}
        />
      )}
    </section>
  );
}