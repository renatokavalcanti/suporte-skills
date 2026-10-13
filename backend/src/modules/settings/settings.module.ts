import { Module } from '@nestjs/common';
import { AiModule } from '../../shared/ai/ai.module';
import { BrandingSettingsService } from './branding-settings.service';
import { EmailSettingsService } from './email-settings.service';
import { MailerService } from './mailer.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [AiModule],
  controllers: [SettingsController],
  providers: [
    SettingsService,
    EmailSettingsService,
    BrandingSettingsService,
    MailerService,
  ],
  exports: [
    SettingsService,
    EmailSettingsService,
    BrandingSettingsService,
    MailerService,
  ],
})
export class SettingsModule {}
