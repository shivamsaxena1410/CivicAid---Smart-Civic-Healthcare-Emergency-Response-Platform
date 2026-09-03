import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

/**
 * Baseline security response headers.
 *
 * This is the subset of `helmet` that actually applies to a JSON API served to
 * a separate SPA origin. It is written by hand rather than pulling in a new
 * dependency; if `helmet` is added later this can be deleted in favour of it.
 * No CSP is set here — this process serves no HTML except Swagger UI, which is
 * disabled in production.
 */
function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.removeHeader('X-Powered-By');
  next();
}

async function bootstrap() {
  const logger = new Logger('CivicConnectAPI');
  const app = await NestFactory.create(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(securityHeaders);

  // Global Route Prefix
  const apiPrefix = process.env.API_PREFIX || '/api/v1';
  app.setGlobalPrefix(apiPrefix.replace(/^\//, ''));

  // CORS Configuration
  const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  const corsOrigins = isProduction
    ? [allowedOrigin]
    : [allowedOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // `forbidNonWhitelisted` was false, so unknown properties were silently
      // dropped instead of rejected. Silent stripping hides client bugs and
      // makes privilege-escalation probes (posting `role`, `verificationStatus`)
      // look successful. Reject them instead.
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        // Query params arrive as strings; this coerces them to the declared
        // types. Booleans are the exception — `"false"` is truthy — so boolean
        // query params use the explicit `@ToBoolean()` decorator.
        enableImplicitConversion: true,
      },
    }),
  );

  // Global Exception Filter & Response Transform Interceptor
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger OpenAPI Documentation — development only. In production the schema
  // is a map of every endpoint, role requirement and payload shape; there is no
  // reason to publish it unauthenticated alongside the live API.
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('CivicConnect — Civic Health & Emergency API')
      .setDescription(
        'Civic health platform connecting citizens with verified hospitals, blood banks, pharmacies, ambulances, NGOs, and health authorities.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .addTag('Authentication', 'User registration, login, token refresh, and profile')
      .addTag('Organizations & Healthcare Facilities', 'Geospatial facility search and profile endpoints')
      .addTag('Hospitals & Live Capacity', 'Hospital bed availability and emergency status')
      .addTag('Blood Banks & Availability', 'Inventory across 8 blood groups')
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
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`CivicConnect API listening on http://localhost:${port}${apiPrefix}`);
  if (!isProduction) {
    logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
