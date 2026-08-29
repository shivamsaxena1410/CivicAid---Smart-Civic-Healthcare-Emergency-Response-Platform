import { IsBoolean, IsInt, IsOptional, IsString, Min, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateHospitalCapacityDto {
  @ApiPropertyOptional({ example: 450 })
  @IsOptional()
  @IsInt()
  @Min(0)
  totalBeds?: number;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsInt()
  @Min(0)
  availableGeneralBeds?: number;

  @ApiPropertyOptional({ example: 18 })
  @IsOptional()
  @IsInt()
  @Min(0)
  availableIcuBeds?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  emergencyAvailable?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  hasOxygenSupport?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  hasVentilators?: boolean;

  @ApiPropertyOptional({ example: ['Cardiology', 'Neurology', 'Oncology'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departments?: string[];

  @ApiPropertyOptional({ example: ['24/7 Trauma Care', 'CT/MRI Scan'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  services?: string[];

  @ApiPropertyOptional({ example: '24/7' })
  @IsOptional()
  @IsString()
  operatingHours?: string;
}
