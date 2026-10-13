import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Vinculo em lote de chamados nao mapeados a um cliente (D-031). Aceita duas
 * formas (mutuamente exclusivas na pratica):
 * - `accountId`: vincula **todos** os chamados daquela conta do Zoho;
 * - `ids`: vincula as linhas selecionadas na fila.
 */
export class BulkLinkUnmappedDto {
  /** Id local do cliente ao qual os chamados serao vinculados. */
  @IsString()
  @IsNotEmpty({ message: 'Informe o cliente' })
  @MaxLength(40)
  clientId!: string;

  /** Ids locais das linhas da fila (vinculo por selecao). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  ids?: string[];

  /** Conta do Zoho: vincula todos os chamados daquela conta de uma vez. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  accountId?: string;
}
