import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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
    }),
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
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
