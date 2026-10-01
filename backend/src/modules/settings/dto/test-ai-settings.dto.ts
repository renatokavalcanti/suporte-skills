import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Teste de conexao. Os campos permitem testar valores ainda nao salvos; o que
 * nao for enviado usa a configuracao efetiva (banco + ambiente).
 */
export class TestAiSettingsDto {
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(120000)
  timeoutMs?: number;
}
