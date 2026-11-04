import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthRepository } from './auth.repository.js';
import { DatabaseModule } from '../database/database.module.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';

const jwtSecret = process.env.JWT_SECRET ?? '';

@Module({
  imports: [DatabaseModule, JwtModule.register({ global: true, secret: jwtSecret, signOptions: { expiresIn: '1d' } })],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, JwtAuthGuard, PermissionsGuard],
  exports: [AuthService, AuthRepository, JwtModule, JwtAuthGuard, PermissionsGuard],
})
export class AuthModule {}
