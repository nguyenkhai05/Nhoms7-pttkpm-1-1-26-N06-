export default function PitchFilterBar({
  onSearch,
}: {
  onSearch: (q: Record<string, string>) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(
          Object.fromEntries(new FormData(e.currentTarget)) as Record<
            string,
            string
          >,
        );
      }}
    >
      <select name="type">
        <option value="">Mọi loại sân</option>
        {[5, 7, 11].map((x) => (
          <option key={x} value={x}>
            Sân {x} người
          </option>
        ))}
      </select>
      <input name="district" placeholder="Quận/huyện" />
      <input name="minPrice" type="number" min="0" placeholder="Giá từ" />
      <input name="maxPrice" type="number" min="0" placeholder="Giá đến" />
      <select name="amenities">
        <option value="">Mọi tiện ích</option>
        <option value="1">Bãi xe</option>
        <option value="2">Phòng thay đồ</option>
        <option value="3">Vòi tắm</option>
        <option value="4">Đèn chiếu sáng</option>
      </select>
      <button>Tìm sân</button>
    </form>
  );
}
