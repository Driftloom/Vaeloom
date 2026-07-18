import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
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

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  app.enableShutdownHooks();

  app.setGlobalPrefix('api/v1', { exclude: ['health', 'metrics'] });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Vaeloom RBAC Service')
    .setDescription('Role-based access control and permission engine')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('app.port') ?? 3170;
  await app.listen(port);
  app.get(Logger).log(`RBAC service running on http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
