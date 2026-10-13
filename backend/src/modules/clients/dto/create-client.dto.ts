import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do cliente' })
  @MaxLength(160)
  name!: string;

  /** CNPJ/NIF do cliente. Unico quando informado (D-029). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  document?: string;

  /** Id da conta no Zoho Desk. Unico quando informado (D-029). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  zohoAccountId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
