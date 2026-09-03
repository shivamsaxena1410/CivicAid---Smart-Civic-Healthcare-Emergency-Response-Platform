import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { HospitalModule } from './modules/hospital/hospital.module';
import { BloodBankModule } from './modules/blood-bank/blood-bank.module';
import { PharmacyModule } from './modules/pharmacy/pharmacy.module';
import { AmbulanceModule } from './modules/ambulance/ambulance.module';
import { SchemeModule } from './modules/scheme/scheme.module';
import { ComplaintModule } from './modules/complaint/complaint.module';
import { AlertModule } from './modules/alert/alert.module';
import { AIChatModule } from './modules/ai-chat/ai-chat.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      // Fail at bootstrap on a missing/weak/known-public JWT secret rather than
      // falling back to a committed default. See config/env.validation.ts.
      validate: validateEnv,
    }),
    // One global bucket. Sensitive handlers tighten it per-route with
    // `@Throttle({ default: { ... } })` rather than declaring extra named
    // throttlers here, because every throttler listed in `forRoot` applies to
    // every route — a second strict entry would cap facility search too.
    //
    // Storage is in-memory: counters are per-process and reset on restart. That
    // is honest for a single-container deployment and is what this project runs.
    // A multi-instance deployment needs a shared store; Redis is already in the
    // compose file, but the throttler's Redis storage adapter is a separate
    // package that is deliberately not installed here.
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),
    PrismaModule,
    AuthModule,
    OrganizationModule,
    HospitalModule,
    BloodBankModule,
    PharmacyModule,
    AmbulanceModule,
    SchemeModule,
    ComplaintModule,
    AlertModule,
    AIChatModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global guard order matters and is deliberate:
    //   1. ThrottlerGuard  — rate-limit before doing any work, including for
    //                        unauthenticated callers hammering /auth/login.
    //   2. JwtAuthGuard    — authentication is DENY-BY-DEFAULT. Every route
    //                        requires a valid access token unless it opts out
    //                        with @Public(). Previously only ThrottlerGuard was
    //                        registered here, which made @Public() a no-op and
    //                        left each route's protection dependent on someone
    //                        remembering @UseGuards(JwtAuthGuard).
    //   3. RolesGuard      — authorization, once req.user is populated. Returns
    //                        true when a handler declares no @Roles(...).
    // Per-controller @UseGuards(...) declarations are now redundant but
    // harmless, and are kept as local documentation of intent.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
