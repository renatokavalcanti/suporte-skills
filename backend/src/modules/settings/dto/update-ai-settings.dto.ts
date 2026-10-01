import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateAiSettingsDto {
  /** Liga/desliga o uso da IA (resumo do Tec News). */
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

  /** Nova chave da API. Em branco/ausente mantem a atual. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  /** Remove a chave salva (nao afeta uma chave vinda do ambiente). */
  @IsOptional()
  @IsBoolean()
  clearApiKey?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(120000)
  timeoutMs?: number;

  @IsOptional()
  @IsBoolean()
  digestEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  digestWindowDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  digestMaxItems?: number;
}
