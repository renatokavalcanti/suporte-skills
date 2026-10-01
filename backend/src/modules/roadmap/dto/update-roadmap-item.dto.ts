import { PartialType } from '@nestjs/mapped-types';
import { IsEnum } from 'class-validator';
import { RoadmapStatus } from '@prisma/client';
import { CreateRoadmapItemDto } from './create-roadmap-item.dto';

export class UpdateRoadmapItemDto extends PartialType(CreateRoadmapItemDto) {}

export class UpdateRoadmapStatusDto {
  @IsEnum(RoadmapStatus)
  status!: RoadmapStatus;
}
