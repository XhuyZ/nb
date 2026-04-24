import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokensRepository: Repository<PasswordResetToken>,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByUsername(loginDto.username);

    if (!user || user.password !== loginDto.password) {
      throw new UnauthorizedException('Invalid username or password');
    }

    if (!user.status) {
      throw new UnauthorizedException('Account is inactive');
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      token_type: 'Bearer',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (!dto.oldPassword || !dto.newPassword) {
      throw new BadRequestException('Old password and new password are required');
    }
    if (dto.newPassword.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters');
    }

    const user = await this.usersService.findOne(userId);
    if (user.password !== dto.oldPassword) {
      throw new UnauthorizedException('Old password is incorrect');
    }

    user.password = dto.newPassword;
    await this.usersService.update(userId, { password: dto.newPassword });
    return { userId };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    if (!dto.username) {
      throw new BadRequestException('Username is required');
    }

    const user = await this.usersService.findByUsername(dto.username);
    // For demo/local: don't leak whether user exists; always return success shape.
    if (!user) {
      return {
        resetToken: null,
        expiresInSeconds: 900,
      };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.passwordResetTokensRepository.save(
      this.passwordResetTokensRepository.create({
        user,
        tokenHash,
        expiresAt,
      }),
    );

    return {
      resetToken: rawToken,
      expiresInSeconds: 900,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (!dto.token || !dto.newPassword) {
      throw new BadRequestException('Token and new password are required');
    }
    if (dto.newPassword.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters');
    }

    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const record = await this.passwordResetTokensRepository.findOne({
      where: { tokenHash },
      relations: { user: true },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid reset token');
    }
    if (record.usedAt) {
      throw new UnauthorizedException('Reset token has already been used');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Reset token has expired');
    }

    await this.usersService.update(record.user.id, { password: dto.newPassword });
    record.usedAt = new Date();
    await this.passwordResetTokensRepository.save(record);

    return { userId: record.user.id };
  }
}
