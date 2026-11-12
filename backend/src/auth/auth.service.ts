import { Injectable, ConflictException, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthRepository } from './auth.repository.js';
import { RegisterDto, LoginDto } from './dto/auth.dto.js';
import { isValidVietnamesePhone, normalizeVietnamesePhone } from './phone.util.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email?.trim().toLowerCase();
    const fullName = dto.fullName?.trim();
    const phone = dto.phone ? normalizeVietnamesePhone(dto.phone) : '';
    if (!email || !fullName || !dto.password || !phone) {
      throw new BadRequestException('Vui lòng nhập họ tên, email, số điện thoại và mật khẩu.');
    }
    if (dto.password.length < 8) throw new BadRequestException('Mật khẩu phải có ít nhất 8 ký tự.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Email không hợp lệ.');
    if (!isValidVietnamesePhone(phone)) throw new BadRequestException('Số điện thoại phải gồm 10 chữ số hợp lệ tại Việt Nam.');
    if (await this.authRepository.findByEmail(email)) throw new ConflictException('Email này đã được đăng ký.');
    if (await this.authRepository.findByPhone(phone)) throw new ConflictException('Số điện thoại này đã được đăng ký.');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    try {
      const userId = await this.authRepository.createCustomer({ ...dto, email, fullName, phone }, passwordHash);
      return { statusCode: 201, message: 'Đăng ký tài khoản thành công.', data: { userId, role: 'CUSTOMER' } };
    } catch (error) {
      // Unique email/phone constraints also protect against concurrent registrations.
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Email hoặc số điện thoại đã được đăng ký.');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const identifier = (dto.identifier ?? dto.username ?? '').trim();
    if (!identifier || !dto.password) throw new BadRequestException('Vui lòng nhập email/số điện thoại và mật khẩu.');
    const user = await this.authRepository.findByIdentifier(identifier);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác.');
    }
    if (user.status !== 'ACTIVE') throw new ForbiddenException('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.');

    const access = await this.authRepository.getUserAccess(user.id);
    if (!access.roles.length) throw new ForbiddenException('Tài khoản chưa được cấp vai trò.');
    const accessToken = await this.jwtService.signAsync({ sub: user.id });
    return {
      statusCode: 200,
      message: 'Đăng nhập thành công.',
      data: {
        accessToken,
        user: { id: user.id, email: user.email, fullName: user.fullName, phone: user.phone, roles: access.roles, permissions: access.permissions },
      },
    };
  }

  async me(userId: number) {
    const user = await this.authRepository.findByUserId(userId);
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Phiên đăng nhập không còn hợp lệ.');
    const access = await this.authRepository.getUserAccess(user.id);
    return { statusCode: 200, data: { id: user.id, email: user.email, fullName: user.fullName, phone: user.phone, roles: access.roles, permissions: access.permissions } };
  }
}
