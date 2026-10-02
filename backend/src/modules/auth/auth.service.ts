import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import { Professional } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { LoginThrottleService } from './login-throttle.service';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly loginThrottle: LoginThrottleService,
  ) {}

  async login(dto: LoginDto, clientKey = 'unknown'): Promise<AuthResult> {
    const throttleKey = `${clientKey}::${dto.email.toLowerCase().trim()}`;
    this.loginThrottle.assertAllowed(throttleKey);

    const professional = await this.prisma.professional.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    // Mensagem generica: nao revela se o e-mail existe.
    if (!professional || !professional.passwordHash) {
      this.loginThrottle.registerFailure(throttleKey);
      throw new UnauthorizedException('Credenciais invalidas');
    }

    if (!professional.active) {
      this.loginThrottle.registerFailure(throttleKey);
      throw new UnauthorizedException('Usuario inativo');
    }

    const passwordMatches = await verify(
      professional.passwordHash,
      dto.password,
    ).catch(() => false);

    if (!passwordMatches) {
      this.loginThrottle.registerFailure(throttleKey);
      throw new UnauthorizedException('Credenciais invalidas');
    }

    this.loginThrottle.reset(throttleKey);
    return this.issueTokens(professional);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { professional: true },
    });

    if (
      !stored ||
      stored.expiresAt.getTime() < Date.now() ||
      !stored.professional.active
    ) {
      throw new UnauthorizedException('Sessao expirada ou invalida');
    }

    // Deteccao de reuso: um token ja rotacionado nao pode voltar a ser usado.
    // Se acontecer, tratamos como possivel roubo e revogamos todas as sessoes.
    if (stored.revokedAt) {
      this.logger.warn(
        `Reuso de refresh token detectado (profissional ${stored.professionalId}); revogando todas as sessoes`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { professionalId: stored.professionalId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Sessao expirada ou invalida');
    }

    // Rotacao: revoga o token atual e emite um novo par.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.professional);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<AuthenticatedUser> {
    const professional = await this.prisma.professional.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        mustChangePassword: true,
      },
    });

    if (!professional || !professional.active) {
      throw new UnauthorizedException('Usuario inativo ou inexistente');
    }

    return {
      id: professional.id,
      email: professional.email,
      name: professional.name,
      role: professional.role,
      mustChangePassword: professional.mustChangePassword,
    };
  }

  /**
   * Troca de senha do proprio usuario (D-024). Exige a senha atual, grava a
   * nova, limpa a marca de senha provisoria e revoga as sessoes anteriores,
   * devolvendo um novo par de tokens.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<AuthResult> {
    const professional = await this.prisma.professional.findUnique({
      where: { id: userId },
    });

    if (!professional || !professional.active || !professional.passwordHash) {
      throw new UnauthorizedException('Usuario inativo ou inexistente');
    }

    const matches = await verify(
      professional.passwordHash,
      dto.currentPassword,
    ).catch(() => false);
    if (!matches) {
      throw new BadRequestException('A senha atual nao confere');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('A nova senha deve ser diferente da atual');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.professional.update({
        where: { id: professional.id },
        data: {
          passwordHash: await hash(dto.newPassword),
          mustChangePassword: false,
        },
      });
      // Qualquer sessao anterior deixa de valer ao trocar a senha.
      await tx.refreshToken.updateMany({
        where: { professionalId: professional.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return saved;
    });

    return this.issueTokens(updated);
  }

  static async hashPassword(password: string): Promise<string> {
    return hash(password);
  }

  private async issueTokens(professional: Professional): Promise<AuthResult> {
    const user: AuthenticatedUser = {
      id: professional.id,
      email: professional.email,
      name: professional.name,
      role: professional.role,
      mustChangePassword: professional.mustChangePassword,
    };

    const accessToken = await this.jwt.signAsync({
      sub: professional.id,
      email: professional.email,
      role: professional.role,
      mustChangePassword: professional.mustChangePassword,
    });

    const refreshToken = randomBytes(48).toString('hex');
    const refreshTtlMs = this.parseDurationToMs(
      this.config.get<string>('auth.refreshTtl') ?? '7d',
    );

    await this.prisma.refreshToken.create({
      data: {
        professionalId: professional.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtlMs),
      },
    });

    return { accessToken, refreshToken, user };
  }

  private hashToken(token: string): string {
    return createHash('sha256')
      .update(token + (this.config.get<string>('auth.refreshSecret') ?? ''))
      .digest('hex');
  }

  private parseDurationToMs(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value.trim());
    if (!match) {
      this.logger.warn(
        `JWT_REFRESH_TTL invalido ("${value}"); usando 7d como padrao`,
      );
      return 7 * 24 * 60 * 60 * 1000;
    }
    const amount = Number.parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return amount * multipliers[unit];
  }
}
