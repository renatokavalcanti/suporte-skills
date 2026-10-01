import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginThrottleService } from './login-throttle.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions =>
        ({
          secret: config.get<string>('auth.accessSecret'),
          signOptions: {
            // "15m", "1h" etc. sao validos em runtime (pacote ms);
            // o tipo StringValue do Nest nao aceita "string" generica.
            expiresIn: config.get<string>('auth.accessTtl') ?? '15m',
          },
        }) as unknown as JwtModuleOptions,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LoginThrottleService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
