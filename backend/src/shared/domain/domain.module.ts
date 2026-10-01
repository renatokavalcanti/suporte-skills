import { Global, Module } from '@nestjs/common';
import { CertificationStatusService } from './certification-status.service';
import { CoverageService } from './coverage.service';

@Global()
@Module({
  providers: [CertificationStatusService, CoverageService],
  exports: [CertificationStatusService, CoverageService],
})
export class DomainModule {}
