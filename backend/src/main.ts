import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('CivicConnectAPI');
  const app = await NestFactory.create(AppModule);

  // Global Route Prefix
  const apiPrefix = process.env.API_PREFIX || '/api/v1';
  app.setGlobalPrefix(apiPrefix.replace(/^\//, ''));

  // CORS Configuration
  const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  app.enableCors({
    origin: [allowedOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global Exception Filter & Response Transform Interceptor
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('CivicConnect — Civic Health & Emergency API')
    .setDescription(
      'Production-oriented civic health platform connecting citizens with verified hospitals, blood banks, pharmacies, ambulances, NGOs, and health authorities.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Authentication', 'User registration, login, token refresh, and profile')
    .addTag('Organizations & Healthcare Facilities', 'Geospatial facility search and profile endpoints')
    .addTag('Hospitals & Live Capacity', 'Hospital bed availability and emergency status')
    .addTag('Blood Banks & Availability', 'Real-time inventory across 8 blood groups')
    .addTag('Pharmacies & Medicine Stock', 'Medicine availability search and catalog management')
    .addTag('Ambulance & Emergency Dispatch', 'Ambulance fleet status and dispatch workflow')
    .addTag('Government Health Schemes', 'Public healthcare schemes and eligibility info')
    .addTag('Citizen Grievances & Complaints', 'Public reporting and dispute resolution')
    .addTag('Emergency Health Alerts', 'Public health warnings and advisories')
    .addTag('AI Health Assistant', 'Health advisory chatbot with emergency triaging')
    .addTag('Admin & Platform Governance', 'KYC approvals, user management, and audit logs')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'CivicConnect API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 CivicConnect API Server running on: http://localhost:${port}${apiPrefix}`);
  logger.log(`📖 Swagger OpenAPI Interactive Docs: http://localhost:${port}/api/docs`);
}

bootstrap();
