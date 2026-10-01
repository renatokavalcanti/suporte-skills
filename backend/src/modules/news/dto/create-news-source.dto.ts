import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { NewsConnectorType } from '@prisma/client';

export class CreateNewsSourceDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o fabricante' })
  vendorId!: string;

  @IsOptional()
  @IsString()
  technologyId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe o nome da fonte' })
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  url?: string;

  @IsOptional()
  @IsEnum(NewsConnectorType)
  connectorType?: NewsConnectorType;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(10080)
  fetchIntervalMinutes?: number;
}
