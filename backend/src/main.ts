import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');

  // Headers de seguranca (a API serve apenas JSON; CSP nao afeta os dados).
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: config.get<string[]>('corsOrigin') ?? true,
    credentials: true,
  });

  app.enableShutdownHooks();

  const port = config.get<number>('port') ?? 4000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`Suporte Skills API ouvindo em http://localhost:${port}/api/v1`);
}

void bootstrap();
