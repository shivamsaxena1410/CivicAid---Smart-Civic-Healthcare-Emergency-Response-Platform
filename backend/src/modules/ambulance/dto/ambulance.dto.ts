import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AmbulanceStatus, AmbulanceRequestStatus } from '@prisma/client';
import { GeoSearchDto } from '../../../common/dto/pagination.dto';
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator';

export class AmbulanceSearchDto extends GeoSearchDto {
  @ApiPropertyOptional({ description: 'Only return providers that currently have an AVAILABLE vehicle' })
  @ToBoolean()
  @IsBoolean()
  @IsOptional()
  availableOnly?: boolean;
}

export class CreateAmbulanceRequestDto {
  @ApiProperty({ example: 12.9716 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsNotEmpty()
  pickupLatitude: number;

  @ApiProperty({ example: 77.5946 })
  @IsNumber()
  @Min(-180)
  @Max(180)
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

  @ApiPropertyOptional({
    description:
      'Vehicle being dispatched. Required when accepting a request from the unassigned open queue; the vehicle must belong to the caller.',
  })
  @IsOptional()
  @IsString()
  ambulanceId?: string;
}
