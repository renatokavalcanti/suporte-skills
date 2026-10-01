import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { NewsKind } from '@prisma/client';

export class CreateNewsItemDto {
  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsString()
  technologyId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe o titulo' })
  @MaxLength(400)
  title!: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe o link oficial' })
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  author?: string;

  @IsOptional()
  @IsEnum(NewsKind)
  kind?: NewsKind;

  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}
