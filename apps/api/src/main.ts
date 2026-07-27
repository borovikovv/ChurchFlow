import 'reflect-metadata';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { StructuredLoggingInterceptor } from './common/interceptors/structured-logging.interceptor';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const webAppUrl = config.getOrThrow<string>('WEB_APP_URL');

  app.enableShutdownHooks();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.enableCors({
    origin: webAppUrl,
    credentials: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new StructuredLoggingInterceptor());
  app.useGlobalPipes(new ZodValidationPipe());
  app.setGlobalPrefix('v1');

  await app.listen(config.getOrThrow<number>('PORT'));
}

void bootstrap();
