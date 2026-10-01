import { Module } from '@nestjs/common';
import { AiClient } from './ai-client.service';

@Module({
  providers: [AiClient],
  exports: [AiClient],
})
export class AiModule {}
