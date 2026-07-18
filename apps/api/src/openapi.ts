import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';
import { AppModule } from './app.module';

async function generateOpenAPI() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Vaeloom API')
    .setDescription('Memory-first personal intelligence platform API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  fs.writeFileSync('openapi.json', JSON.stringify(document, null, 2));
  console.log('OpenAPI spec generated at openapi.json');
  await app.close();
}

generateOpenAPI();
