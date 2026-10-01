import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../database/prisma.service';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../../../shared/common/authenticated-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('auth.accessSecret') as string,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const professional = await this.prisma.professional.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, active: true },
    });

    if (!professional || !professional.active) {
      throw new UnauthorizedException('Usuario inativo ou inexistente');
    }

    return {
      id: professional.id,
      email: professional.email,
      name: professional.name,
      role: professional.role,
    };
  }
}
