import type { Pitch } from "../types";

import FootballPitchCard from "./FootballPitchCard";
export default function FootballPitchList({
  pitches,
  onOpen,
}: {
  pitches: Pitch[];
  onOpen: (id: number) => void;
}) {
  return pitches.length ? (
    <section className="cards">
      {pitches.map((p) => (
        <FootballPitchCard key={p.id} pitch={p} onOpen={onOpen} />
      ))}
    </section>
  ) : (
    <p>Không tìm thấy sân phù hợp. Hãy thử bỏ bớt bộ lọc.</p>
  );
}
