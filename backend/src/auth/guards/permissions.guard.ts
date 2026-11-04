import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS } from './permissions.decorator.js';
import type { AuthenticatedRequest } from './jwt-auth.guard.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [context.getHandler(), context.getClass()]) ?? [];
    if (!required.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const allowed = required.every((permission) => request.user?.permissions.includes(permission));
    if (!allowed) throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này.');
    return true;
  }
}
