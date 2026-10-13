import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ZOHO_DATA_CENTERS, ZohoDataCenter } from '../zoho/zoho-domains';

/**
 * Teste de conexao com o Zoho Desk. Todos os campos sao opcionais: o que nao for
 * informado usa a configuracao efetiva (salva ou do ambiente).
 */
export class TestZohoConnectionDto {
  @IsOptional()
  @IsString()
  @IsIn(ZOHO_DATA_CENTERS as readonly string[])
  dataCenter?: ZohoDataCenter;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  clientSecret?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  refreshToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  orgId?: string;
}
