import { IsEmail, IsOptional } from 'class-validator';

export class TestEmailSettingsDto {
  /** Destino do e-mail de teste. Ausente usa o remetente configurado. */
  @IsOptional()
  @IsEmail({}, { message: 'Informe um e-mail de destino valido' })
  to?: string;
}
