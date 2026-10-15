import { IsEmail, IsOptional } from 'class-validator';
import { UpdateEmailSettingsDto } from './update-email-settings.dto';

/**
 * Teste de envio (D-030/D-036). Aceita, opcionalmente, os **mesmos campos** de
 * `UpdateEmailSettingsDto` como *overrides* transitorios (nada e' persistido),
 * para permitir **testar antes de habilitar/salvar**.
 */
export class TestEmailSettingsDto extends UpdateEmailSettingsDto {
  /** Destino do e-mail de teste. Ausente usa o remetente configurado. */
  @IsOptional()
  @IsEmail({}, { message: 'Informe um e-mail de destino valido' })
  to?: string;
}
