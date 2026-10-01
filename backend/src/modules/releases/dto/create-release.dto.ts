import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateReleaseItemDto } from './create-release-item.dto';

export class CreateReleaseDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe a versao' })
  @Matches(/^\d+\.\d+\.\d+(?:[-+].+)?$/, {
    message: 'A versao deve seguir o formato X.Y.Z',
  })
  @MaxLength(50)
  version!: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe o titulo' })
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;

  @IsDateString()
  releasedAt!: string;

  @IsOptional()
  @IsBoolean()
  current?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateReleaseItemDto)
  items?: CreateReleaseItemDto[];
}
