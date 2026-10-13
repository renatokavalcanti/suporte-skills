import { Module } from '@nestjs/common';
import { MeasurementsController } from './measurements.controller';
import { MeasurementsService } from './measurements.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { ZohoClientService } from './zoho/zoho-client.service';
import { ZohoCredentialsService } from './zoho/zoho-credentials.service';
import { ZohoIntegrationController } from './zoho/zoho-integration.controller';
import { ZohoSettingsService } from './zoho/zoho-settings.service';
import { ZohoSyncScheduler } from './zoho-sync.scheduler';
import { ZohoSyncService } from './zoho-sync.service';

@Module({
  controllers: [TicketsController, MeasurementsController, ZohoIntegrationController],
  providers: [
    TicketsService,
    MeasurementsService,
    ZohoSettingsService,
    ZohoCredentialsService,
    ZohoClientService,
    ZohoSyncService,
    ZohoSyncScheduler,
  ],
  exports: [TicketsService, ZohoSyncService, MeasurementsService],
})
export class TicketsModule {}
