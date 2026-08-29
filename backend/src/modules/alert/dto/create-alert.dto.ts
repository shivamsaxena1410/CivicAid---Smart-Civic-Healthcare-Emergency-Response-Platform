import { IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AlertSeverity } from '@prisma/client';

export class CreateAlertDto {
  @ApiProperty({ example: '⚠️ Heatwave Advisory & Hydration Directives (Level Yellow)' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'District Health Authority advises citizens to avoid direct sun exposure between 12 PM - 3:30 PM.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ enum: AlertSeverity, example: AlertSeverity.HIGH })
  @IsEnum(AlertSeverity)
  @IsNotEmpty()
  severity: AlertSeverity;

  @ApiProperty({ example: 'Bengaluru Urban & Rural Districts' })
  @IsString()
  @IsNotEmpty()
  affectedArea: string;

  @ApiPropertyOptional({ example: '2026-09-05T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
