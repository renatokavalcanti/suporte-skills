import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TechnologyCategory } from '@prisma/client';

export class CreateTechnologyDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o fabricante' })
  vendorId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe o nome da tecnologia' })
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsEnum(TechnologyCategory)
  category?: TechnologyCategory;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
