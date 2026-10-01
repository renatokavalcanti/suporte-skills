import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface AttemptWindow {
  failures: number;
  firstAt: number;
  blockedUntil: number | null;
}

/**
 * Limitador de tentativas de login (protecao contra forca bruta).
 * Conta apenas FALHAS por par (IP + e-mail); um login bem-sucedido zera o
 * contador. Ao atingir o limite, o par fica bloqueado por uma janela.
 * Estado em memoria: suficiente para uma instancia; com multiplas replicas
 * deve ser trocado por um store compartilhado (Redis).
 */
@Injectable()
export class LoginThrottleService {
  private readonly attempts = new Map<string, AttemptWindow>();

  constructor(private readonly config: ConfigService) {}

  private get maxAttempts(): number {
    return this.config.get<number>('auth.loginMaxAttempts') ?? 5;
  }

  private get windowMs(): number {
    return (
      (this.config.get<number>('auth.loginWindowMinutes') ?? 15) * 60 * 1000
    );
  }

  assertAllowed(key: string): void {
    const entry = this.attempts.get(key);
    if (!entry) return;

    const now = Date.now();

    if (entry.blockedUntil) {
      if (entry.blockedUntil > now) {
        const retryAfterSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
        throw new HttpException(
          {
            message: `Muitas tentativas de login. Tente novamente em ${Math.ceil(
              retryAfterSeconds / 60,
            )} minuto(s).`,
            retryAfterSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      this.attempts.delete(key);
      return;
    }

    if (now - entry.firstAt > this.windowMs) {
      this.attempts.delete(key);
    }
  }

  registerFailure(key: string): void {
    const now = Date.now();
    const entry = this.attempts.get(key);

    if (!entry || now - entry.firstAt > this.windowMs) {
      this.attempts.set(key, { failures: 1, firstAt: now, blockedUntil: null });
      return;
    }

    entry.failures += 1;
    if (entry.failures >= this.maxAttempts) {
      entry.blockedUntil = now + this.windowMs;
    }
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}
