import { Module } from '@nestjs/common';
import { RoadmapModule } from '../roadmap/roadmap.module';
import { ProfessionalCertificationsService } from './professional-certifications.service';
import { ProfessionalsController } from './professionals.controller';
import { ProfessionalsService } from './professionals.service';

@Module({
  imports: [RoadmapModule],
  controllers: [ProfessionalsController],
  providers: [ProfessionalsService, ProfessionalCertificationsService],
  exports: [ProfessionalsService, ProfessionalCertificationsService],
})
export class ProfessionalsModule {}
