export const money = (value: number) => value.toLocaleString("vi-VN") + " đ";
export const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
    new Date(),
  );
