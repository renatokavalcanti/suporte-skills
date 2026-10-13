import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { ZohoClientService } from './zoho/zoho-client.service';
import { ZohoCredentialsService } from './zoho/zoho-credentials.service';
import { ZohoSyncScheduler } from './zoho-sync.scheduler';
import { ZohoSyncService } from './zoho-sync.service';

@Module({
  controllers: [TicketsController],
  providers: [
    TicketsService,
    ZohoCredentialsService,
    ZohoClientService,
    ZohoSyncService,
    ZohoSyncScheduler,
  ],
  exports: [TicketsService, ZohoSyncService],
})
export class TicketsModule {}
