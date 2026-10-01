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
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CreateNewsItemDto } from './dto/create-news-item.dto';
import { QueryNewsDto } from './dto/query-news.dto';
import { SetPinnedDto } from './dto/set-pinned.dto';
import { SetReadDto } from './dto/set-read.dto';
import { SetSavedDto } from './dto/set-saved.dto';
import { UpdateNewsItemDto } from './dto/update-news-item.dto';
import { NewsDigestService } from './news-digest.service';
import { NewsService } from './news.service';
import { NewsSyncService } from './news-sync.service';

@Controller('news')
export class NewsController {
  constructor(
    private readonly service: NewsService,
    private readonly sync: NewsSyncService,
    private readonly digest: NewsDigestService,
  ) {}

  @Get()
  list(@Query() query: QueryNewsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(query, user);
  }

  // Declarado antes de ':id' para nao ser capturado pela rota parametrica.
  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.service.summary(user);
  }

  // Resumo inteligente (destaques para o consultor). Somente leitura para
  // qualquer usuario; a geracao sob demanda e' da gestao.
  @Get('digest')
  async getDigest(@CurrentUser() user: AuthenticatedUser) {
    return {
      aiEnabled: await this.digest.isAiEnabled(),
      autoEnabled: await this.digest.isAutoEnabled(),
      digest: await this.digest.getLatest(user),
    };
  }

  @Post('digest')
  @Roles(Role.ADMIN, Role.MANAGER)
  generateDigest(@CurrentUser() user: AuthenticatedUser) {
    return this.digest.generate(user, 'manual');
  }

  @Post('sync')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(200)
  syncAll() {
    return this.sync.syncAll();
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getById(id, user);
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  create(
    @Body() dto: CreateNewsItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createItem(dto, user);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNewsItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateItem(id, dto, user);
  }

  @Patch(':id/pin')
  @Roles(Role.ADMIN, Role.MANAGER)
  setPinned(
    @Param('id') id: string,
    @Body() dto: SetPinnedDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.setPinned(id, dto.pinned, user);
  }

  @Patch(':id/read')
  setRead(
    @Param('id') id: string,
    @Body() dto: SetReadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.setRead(id, dto.read, user);
  }

  @Patch(':id/save')
  setSaved(
    @Param('id') id: string,
    @Body() dto: SetSavedDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.setSaved(id, dto.saved, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.service.remove(id, user);
  }
}
