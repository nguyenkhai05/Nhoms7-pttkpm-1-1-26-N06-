import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthRepository } from './auth.repository.js';
import { RegisterDto, LoginDto } from './dto/auth.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.username || !dto.password || !dto.email) {
      throw new BadRequestException('Vui lòng điền đầy đủ thông tin bắt buộc');
    }

    const isUsernameExists = await this.authRepository.findByUsername(dto.username);
    if (isUsernameExists) {
      throw new ConflictException('Tên đăng nhập đã được sử dụng');
    }

    const isEmailExists = await this.authRepository.findByEmail(dto.email);
    if (isEmailExists) {
      throw new ConflictException('Email này đã được đăng ký');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const userId = await this.authRepository.createUser(dto, passwordHash);

    return {
      statusCode: 201,
      message: 'Đăng ký tài khoản thành công',
      data: { userId },
    };
  }

  async login(dto: LoginDto) {
    if (!dto.username || !dto.password) {
      throw new BadRequestException('Vui lòng nhập tài khoản và mật khẩu');
    }

    const user = await this.authRepository.findByIdentifier(dto.username);
    if (!user) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác');
    }

    // Đã thay user.password bằng user.passwordHash
    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác');
    }

    const payload = {
      sub: user.id,
      // Dùng email làm username trong token do bảng không có cột username
      username: user.email, 
      // Gán mặc định role cho frontend
      role: 'CUSTOMER', 
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      statusCode: 200,
      message: 'Đăng nhập thành công',
      data: {
        accessToken,
        user: {
          id: user.id,
          username: user.email,       // Sửa user.username -> user.email
          fullName: user.fullName,   // Sửa user.full_name -> user.fullName
          role: 'CUSTOMER',          // Gán mặc định role
        },
      },
    };
  }
}