import { Module } from '@nestjs/common';
import { AiModule } from '../../shared/ai/ai.module';
import { EmailSettingsService } from './email-settings.service';
import { MailerService } from './mailer.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [AiModule],
  controllers: [SettingsController],
  providers: [SettingsService, EmailSettingsService, MailerService],
  exports: [SettingsService, EmailSettingsService, MailerService],
})
export class SettingsModule {}
