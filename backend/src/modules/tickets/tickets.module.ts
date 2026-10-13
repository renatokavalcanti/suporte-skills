import { Module } from '@nestjs/common';
import { ContractsController } from './contracts/contracts.controller';
import { ContractsService } from './contracts/contracts.service';
import { MeasurementsController } from './measurements.controller';
import { MeasurementsService } from './measurements.service';
import { TicketReportsController } from './reports/ticket-reports.controller';
import { TicketReportsService } from './reports/ticket-reports.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { ZohoClientService } from './zoho/zoho-client.service';
import { ZohoCredentialsService } from './zoho/zoho-credentials.service';
import { ZohoIntegrationController } from './zoho/zoho-integration.controller';
import { ZohoOAuthController } from './zoho/zoho-oauth.controller';
import { ZohoOAuthService } from './zoho/zoho-oauth.service';
import { ZohoSettingsService } from './zoho/zoho-settings.service';
import { ZohoSyncScheduler } from './zoho-sync.scheduler';
import { ZohoSyncService } from './zoho-sync.service';

@Module({
  controllers: [
    TicketsController,
    MeasurementsController,
    ContractsController,
    TicketReportsController,
    ZohoIntegrationController,
    ZohoOAuthController,
  ],
  providers: [
    TicketsService,
    MeasurementsService,
    ContractsService,
    TicketReportsService,
    ZohoSettingsService,
    ZohoCredentialsService,
    ZohoClientService,
    ZohoOAuthService,
    ZohoSyncService,
    ZohoSyncScheduler,
  ],
  exports: [
    TicketsService,
    ZohoSyncService,
    MeasurementsService,
    ContractsService,
    TicketReportsService,
  ],
})
export class TicketsModule {}
