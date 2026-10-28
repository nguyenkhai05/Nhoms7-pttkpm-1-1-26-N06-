export class RegisterDto {
  username!: string;
  email!: string;
  password!: string;
  fullName!: string;
  phone?: string;
}

export class LoginDto {
  username!: string;
  password!: string;
}