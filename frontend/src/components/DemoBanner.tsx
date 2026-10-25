import type { ReactNode } from "react";
export default function DemoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="demo-banner">
      <span>ⓘ</span>
      <span>{children}</span>
    </div>
  );
}
