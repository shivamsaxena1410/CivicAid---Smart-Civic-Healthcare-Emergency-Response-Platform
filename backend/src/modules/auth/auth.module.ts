import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService, parseDurationToSeconds } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        // No `||` fallback: a missing secret is a startup failure enforced by
        // validateEnv(), never a silent downgrade to a committed default.
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          // Seconds (a number) rather than the config string, so the value
          // satisfies @nestjs/jwt's `number | ms.StringValue` typing without a
          // cast. This is only a default; AuthService sets expiresIn per sign.
          expiresIn: parseDurationToSeconds(configService.get<string>('JWT_ACCESS_EXPIRATION') ?? '15m'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
