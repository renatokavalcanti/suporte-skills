import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ReleaseCategory } from '@prisma/client';

export class CreateReleaseItemDto {
  @IsOptional()
  @IsEnum(ReleaseCategory)
  category?: ReleaseCategory;

  @IsString()
  @IsNotEmpty({ message: 'Descreva a mudanca' })
  @MaxLength(500)
  description!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}
