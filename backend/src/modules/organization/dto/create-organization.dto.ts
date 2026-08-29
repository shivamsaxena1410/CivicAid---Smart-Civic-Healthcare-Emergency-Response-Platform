import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrgType } from '@prisma/client';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Apollo Clinic & Diagnostic Centre' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: OrgType, example: OrgType.HOSPITAL })
  @IsEnum(OrgType)
  @IsNotEmpty()
  type: OrgType;

  @ApiPropertyOptional({ example: 'Primary outpatient clinic and pathology laboratory.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '12th Main Rd, Indiranagar' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 'Bengaluru' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'Karnataka' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ example: '560038' })
  @IsString()
  @IsNotEmpty()
  pincode: string;

  @ApiProperty({ example: 12.9784 })
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @ApiProperty({ example: 77.6408 })
  @IsNumber()
  @IsNotEmpty()
  longitude: number;

  @ApiProperty({ example: '+91 80 2528 1122' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'contact@apolloclinic.org' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: 'https://apolloclinic.org' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ example: 'KAR-CLINIC-2024-551' })
  @IsOptional()
  @IsString()
  licenseNumber?: string;
}
