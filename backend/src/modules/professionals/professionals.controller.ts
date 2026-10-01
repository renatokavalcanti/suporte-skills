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
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { SetActiveDto } from '../../shared/common/active-status.dto';
import { assertProfessionalAccess } from '../../shared/common/access';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import { RoadmapService } from '../roadmap/roadmap.service';
import { CreateProfessionalCertificationDto } from './dto/create-professional-certification.dto';
import { UpdateProfessionalCertificationDto } from './dto/update-professional-certification.dto';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { QueryProfessionalsDto } from './dto/query-professionals.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';
import { ProfessionalCertificationsService } from './professional-certifications.service';
import { ProfessionalsService } from './professionals.service';

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

  @Get(':id/technologies')
  technologies(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificationsService.listTechnologies(id, user);
  }

  @Get(':id/roadmap')
  roadmap(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    assertProfessionalAccess(id, user);
    return this.roadmapService.listByProfessional(id);
  }

  @Get(':id/history')
  history(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.certificationsService.listHistory(id, user);
  }
}
