import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ZOHO_DATA_CENTERS,
  ZOHO_SYNC_FREQUENCIES,
  ZohoClientSource,
  ZohoDataCenter,
  ZohoSyncFrequency,
} from '../zoho/zoho-domains';

export class UpdateZohoSettingsDto {
  @IsOptional()
  @IsString()
  @IsIn(ZOHO_DATA_CENTERS as readonly string[])
  dataCenter?: ZohoDataCenter;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientId?: string;

  /** Novo Client Secret (em branco/ausente mantem o atual). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  clientSecret?: string;

  @IsOptional()
  @IsBoolean()
  clearClientSecret?: boolean;

  /** Novo Refresh Token (em branco/ausente mantem o atual). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  refreshToken?: string;

  @IsOptional()
  @IsBoolean()
  clearRefreshToken?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  orgId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  scopes?: string[];

  /** Nome da API do campo personalizado de "Tecnologia" no Zoho Desk. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  technologyField?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ACCOUNT', 'CONTACT'])
  clientSource?: ZohoClientSource;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  closedStatuses?: string[];

  @IsOptional()
  @IsString()
  @IsIn(ZOHO_SYNC_FREQUENCIES as readonly string[])
  syncFrequency?: ZohoSyncFrequency;
}
