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
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RoadmapStatus, Role } from '@prisma/client';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { SetActiveDto } from '../../shared/common/active-status.dto';
import { assertProfessionalAccess } from '../../shared/common/access';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import { CreateProfessionalRoadmapItemDto } from '../roadmap/dto/create-professional-roadmap-item.dto';
import {
  UpdateRoadmapItemDto,
  UpdateRoadmapStatusDto,
} from '../roadmap/dto/update-roadmap-item.dto';
import { RoadmapService } from '../roadmap/roadmap.service';
import { CreateProfessionalCertificationDto } from './dto/create-professional-certification.dto';
import { UpdateProfessionalCertificationDto } from './dto/update-professional-certification.dto';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { QueryProfessionalsDto } from './dto/query-professionals.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';
import { ProfessionalCertificationsService } from './professional-certifications.service';
import { ProfessionalsService } from './professionals.service';

/** Teto rígido de memória para o multipart; o limite configurável (MAX_UPLOAD_MB)
 *  é aplicado no serviço. */
const MAX_HARD_UPLOAD_BYTES = 50 * 1024 * 1024;

@Controller('professionals')
export class ProfessionalsController {
  constructor(
    private readonly service: ProfessionalsService,
    private readonly certificationsService: ProfessionalCertificationsService,
    private readonly roadmapService: RoadmapService,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER)
  list(
    @Query() query: QueryProfessionalsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.list(query, user);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getById(id, user);
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  create(
    @Body() dto: CreateProfessionalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProfessionalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.MANAGER)
  setActive(
    @Param('id') id: string,
    @Body() dto: SetActiveDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.setActive(id, dto.active, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.service.deactivate(id, user);
  }

  // --- Certificacoes do profissional (Fase 3) ------------------------------

  @Get(':id/certifications')
  listCertifications(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificationsService.list(id, user);
  }

  // Vinculos de certificacao: ADMIN/MANAGER em qualquer profissional;
  // CONSULTANT apenas nos proprios (D-019). O escopo e validado no servico
  // por assertProfessionalAccess, garantindo 403 para dados de terceiros.
  @Post(':id/certifications')
  @Roles(Role.ADMIN, Role.MANAGER, Role.CONSULTANT)
  addCertification(
    @Param('id') id: string,
    @Body() dto: CreateProfessionalCertificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificationsService.add(id, dto, user);
  }

  @Put(':id/certifications/:recordId')
  @Roles(Role.ADMIN, Role.MANAGER, Role.CONSULTANT)
  updateCertification(
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Body() dto: UpdateProfessionalCertificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificationsService.update(id, recordId, dto, user);
  }

  @Delete(':id/certifications/:recordId')
  @Roles(Role.ADMIN, Role.MANAGER, Role.CONSULTANT)
  @HttpCode(204)
  async removeCertification(
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.certificationsService.remove(id, recordId, user);
  }

  // Anexo do comprovante (D-025): PDF guardado em disco, servido por rota
  // autenticada. Mesmo escopo do vinculo (CONSULTANT apenas nos proprios).
  @Post(':id/certifications/:recordId/attachment')
  @Roles(Role.ADMIN, Role.MANAGER, Role.CONSULTANT)
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_HARD_UPLOAD_BYTES, files: 1 } }),
  )
  uploadAttachment(
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificationsService.uploadAttachment(id, recordId, file, user);
  }

  @Get(':id/certifications/:recordId/attachment')
  async downloadAttachment(
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const attachment = await this.certificationsService.getAttachment(
      id,
      recordId,
      user,
    );
    const asciiName = attachment.name
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/"/g, '');
    res.set({
      'Content-Type': attachment.mime,
      'Content-Length': String(attachment.size),
      'Content-Disposition': `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
    });
    return new StreamableFile(createReadStream(attachment.path));
  }

  @Delete(':id/certifications/:recordId/attachment')
  @Roles(Role.ADMIN, Role.MANAGER, Role.CONSULTANT)
  @HttpCode(204)
  async removeAttachment(
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.certificationsService.removeAttachment(id, recordId, user);
  }

  @Get(':id/technologies')
  technologies(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificationsService.listTechnologies(id, user);
  }

  // --- Roadmap do profissional (D-026) -------------------------------------
  // ADMIN/MANAGER em qualquer profissional; CONSULTANT apenas nos proprios
  // (escopo validado no servico por assertProfessionalAccess). A rota aninhada
  // fixa o profissional; o controller global `/roadmap` segue da gestao.

  @Get(':id/roadmap')
  roadmap(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    assertProfessionalAccess(id, user);
    return this.roadmapService.listByProfessional(id);
  }

  @Post(':id/roadmap')
  @Roles(Role.ADMIN, Role.MANAGER, Role.CONSULTANT)
  createRoadmap(
    @Param('id') id: string,
    @Body() dto: CreateProfessionalRoadmapItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.roadmapService.createForProfessional(id, dto, user);
  }

  @Put(':id/roadmap/:itemId')
  @Roles(Role.ADMIN, Role.MANAGER, Role.CONSULTANT)
  updateRoadmap(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateRoadmapItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.roadmapService.updateForProfessional(id, itemId, dto, user);
  }

  @Patch(':id/roadmap/:itemId/status')
  @Roles(Role.ADMIN, Role.MANAGER, Role.CONSULTANT)
  setRoadmapStatus(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateRoadmapStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.roadmapService.setStatusForProfessional(
      id,
      itemId,
      dto.status as RoadmapStatus,
      user,
    );
  }

  @Delete(':id/roadmap/:itemId')
  @Roles(Role.ADMIN, Role.MANAGER, Role.CONSULTANT)
  @HttpCode(204)
  async removeRoadmap(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.roadmapService.removeForProfessional(id, itemId, user);
  }

  // Anexo do item de roadmap (D-026): PDF guardado em disco e servido por rota
  // autenticada. Mesmo escopo do item (CONSULTANT apenas nos proprios).
  @Post(':id/roadmap/:itemId/attachment')
  @Roles(Role.ADMIN, Role.MANAGER, Role.CONSULTANT)
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_HARD_UPLOAD_BYTES, files: 1 } }),
  )
  uploadRoadmapAttachment(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.roadmapService.uploadAttachment(id, itemId, file, user);
  }

  @Get(':id/roadmap/:itemId/attachment')
  async downloadRoadmapAttachment(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const attachment = await this.roadmapService.getAttachment(id, itemId, user);
    const asciiName = attachment.name
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/"/g, '');
    res.set({
      'Content-Type': attachment.mime,
      'Content-Length': String(attachment.size),
      'Content-Disposition': `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
    });
    return new StreamableFile(createReadStream(attachment.path));
  }

  @Delete(':id/roadmap/:itemId/attachment')
  @Roles(Role.ADMIN, Role.MANAGER, Role.CONSULTANT)
  @HttpCode(204)
  async removeRoadmapAttachment(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.roadmapService.removeAttachment(id, itemId, user);
  }

  @Get(':id/history')
  history(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.certificationsService.listHistory(id, user);
  }
}
