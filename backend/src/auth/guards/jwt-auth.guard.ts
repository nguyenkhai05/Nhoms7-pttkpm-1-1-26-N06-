import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthRepository } from '../auth.repository.js';

export interface AuthenticatedRequest extends Request {
  user: { id: number; roles: string[]; permissions: string[] };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService, private readonly authRepository: AuthRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const [scheme, token] = typeof authorization === 'string' ? authorization.split(' ') : [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Vui lòng đăng nhập để tiếp tục.');

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: number }>(token);
      if (!Number.isInteger(payload.sub)) throw new Error('Invalid subject');
      const user = await this.authRepository.findByUserId(payload.sub);
      if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa.');
      const access = await this.authRepository.getUserAccess(user.id);
      request.user = { id: user.id, roles: access.roles, permissions: access.permissions };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn.');
    }
  }
}
