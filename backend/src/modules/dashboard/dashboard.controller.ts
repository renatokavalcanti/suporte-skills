import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../shared/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

/**
 * Endpoint unico e otimizado para os agregados do dashboard, evitando
 * varias chamadas do frontend (D-011).
 */
@Controller('dashboard')
@Roles(Role.ADMIN, Role.MANAGER)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  overview() {
    return this.service.getOverview();
  }
}
