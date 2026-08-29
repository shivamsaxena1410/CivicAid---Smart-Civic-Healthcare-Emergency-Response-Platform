import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AmbulanceStatus, AmbulanceRequestStatus } from '@prisma/client';

export class CreateAmbulanceRequestDto {
  @ApiProperty({ example: 12.9716 })
  @IsNumber()
  @IsNotEmpty()
  pickupLatitude: number;

  @ApiProperty({ example: 77.5946 })
  @IsNumber()
  @IsNotEmpty()
  pickupLongitude: number;

  @ApiProperty({ example: 'Flat 302, Green Glen Layout, Bellandur, Bengaluru' })
  @IsString()
  @IsNotEmpty()
  pickupAddress: string;

  @ApiProperty({ example: 'Severe breathlessness and chest pain in 65-year-old patient. Oxygen support required.' })
  @IsString()
  @IsNotEmpty()
  emergencyDescription: string;

  @ApiPropertyOptional({ description: 'Target specific ambulance ID if chosen from list' })
  @IsOptional()
  @IsString()
  ambulanceId?: string;
}

export class UpdateAmbulanceStatusDto {
  @ApiProperty({ enum: AmbulanceStatus, example: AmbulanceStatus.AVAILABLE })
  @IsEnum(AmbulanceStatus)
  @IsNotEmpty()
  status: AmbulanceStatus;
}

export class UpdateRequestStatusDto {
  @ApiProperty({ enum: AmbulanceRequestStatus, example: AmbulanceRequestStatus.ACCEPTED })
  @IsEnum(AmbulanceRequestStatus)
  @IsNotEmpty()
  status: AmbulanceRequestStatus;
}
