import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { RoadmapStatus, Role } from '@prisma/client';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CreateRoadmapItemDto } from './dto/create-roadmap-item.dto';
import { QueryRoadmapDto } from './dto/query-roadmap.dto';
import { UpdateRoadmapItemDto, UpdateRoadmapStatusDto } from './dto/update-roadmap-item.dto';
import { RoadmapService } from './roadmap.service';

@Controller('roadmap')
@Roles(Role.ADMIN, Role.MANAGER)
export class RoadmapController {
  constructor(private readonly service: RoadmapService) {}

  @Get()
  list(@Query() query: QueryRoadmapDto) {
    return this.service.list(query);
  }

  @Get('kanban')
  kanban(@Query() query: QueryRoadmapDto) {
    return this.service.kanban(query);
  }

  @Get('timeline')
  timeline(@Query() query: QueryRoadmapDto) {
    return this.service.timeline(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post()
  create(
    @Body() dto: CreateRoadmapItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoadmapItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRoadmapStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.setStatus(id, dto.status as RoadmapStatus, user);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.service.remove(id, user);
  }
}
