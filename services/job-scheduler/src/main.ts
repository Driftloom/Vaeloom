import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Router, type Request, type Response, type NextFunction } from 'express';

import { AppModule } from './app.module';
import { RequestContextMiddleware } from './observability/request-context.middleware';
import { RequestContextService } from './observability/request-context.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  const requestContext = app.get(RequestContextService);
  app.use((req: Request, res: Response, next: NextFunction) =>
    new RequestContextMiddleware(requestContext).use(req, res, next),
  );

  const router = app.get(Router);
  void router;

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({ origin: allowedOrigins, credentials: true });

  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'metrics', 'health/(.*)', 'metrics/(.*)'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Job Scheduler Service')
    .setDescription('Cron scheduling, job persistence and execution dispatch for Vaeloom')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT ?? 3140);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Job Scheduler service listening on port ${port}`);
}

void bootstrap();
