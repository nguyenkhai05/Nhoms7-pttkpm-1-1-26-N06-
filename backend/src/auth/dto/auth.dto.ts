export class RegisterDto {
  email!: string;
  password!: string;
  fullName!: string;
  phone?: string;
}

export class LoginDto {
  /** Tương thích với client cũ dùng username; client mới nên gửi identifier. */
  identifier?: string;
  username?: string;
  password!: string;
}
