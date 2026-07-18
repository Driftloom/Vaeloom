import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.get<string[]>('app.allowedOrigins') ?? ['http://localhost:3000'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Vaeloom API')
    .setDescription('Memory-first personal intelligence platform API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('workspaces', 'Workspace management')
    .addTag('memories', 'Memory CRUD and search')
    .addTag('agents', 'AI agent management and execution')
    .addTag('events', 'Event publishing and subscriptions')
    .addTag('search', 'Unified search across data sources')
    .addTag('integrations', 'Third-party integrations')
    .addTag('billing', 'Usage and subscription management')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('app.port') ?? 4000;
  await app.listen(port);
  app.get(Logger).log(`Vaeloom API running on http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
