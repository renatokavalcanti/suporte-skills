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
import { Role } from '@prisma/client';
import { SetActiveDto } from '../../shared/common/active-status.dto';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CreateNewsSourceDto } from './dto/create-news-source.dto';
import { QueryNewsSourcesDto } from './dto/query-news-sources.dto';
import { UpdateNewsSourceDto } from './dto/update-news-source.dto';
import { NewsSyncService } from './news-sync.service';
import { NewsService } from './news.service';

@Controller('news/sources')
@Roles(Role.ADMIN, Role.MANAGER)
export class NewsSourcesController {
  constructor(
    private readonly service: NewsService,
    private readonly sync: NewsSyncService,
  ) {}

  @Get()
  list(@Query() query: QueryNewsSourcesDto) {
    return this.service.listSources(query);
  }

  @Post()
  create(
    @Body() dto: CreateNewsSourceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createSource(dto, user);
  }

  @Post(':id/sync')
  @HttpCode(200)
  syncOne(@Param('id') id: string) {
    return this.sync.syncSourceById(id);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getSource(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNewsSourceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateSource(id, dto, user);
  }

  @Patch(':id/status')
  setActive(
    @Param('id') id: string,
    @Body() dto: SetActiveDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.setSourceActive(id, dto.active, user);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.service.deactivateSource(id, user);
  }
}
