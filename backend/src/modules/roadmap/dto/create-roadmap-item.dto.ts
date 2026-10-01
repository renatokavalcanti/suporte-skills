import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { RoadmapPriority, RoadmapStatus, RoadmapType } from '@prisma/client';

export class CreateRoadmapItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o profissional' })
  professionalId!: string;

  @IsOptional()
  @IsString()
  technologyId?: string;

  @IsOptional()
  @IsString()
  certificationId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe o objetivo' })
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  objective?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsEnum(RoadmapType)
  type!: RoadmapType;

  @IsOptional()
  @IsEnum(RoadmapPriority)
  priority?: RoadmapPriority;

  @IsOptional()
  @IsEnum(RoadmapStatus)
  status?: RoadmapStatus;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'startDate deve ser uma data ISO (YYYY-MM-DD)' })
  startDate?: string;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'dueDate deve ser uma data ISO (YYYY-MM-DD)' })
  dueDate?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
