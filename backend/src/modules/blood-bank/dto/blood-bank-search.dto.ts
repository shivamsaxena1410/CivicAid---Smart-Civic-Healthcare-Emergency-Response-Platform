import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BloodType } from '@prisma/client';
import { GeoSearchDto } from '../../../common/dto/pagination.dto';

export class BloodBankSearchDto extends GeoSearchDto {
  @ApiPropertyOptional({ enum: BloodType, description: 'Only banks holding this blood type' })
  @IsOptional()
  @IsEnum(BloodType)
  bloodType?: BloodType;

  @ApiPropertyOptional({ description: 'Minimum units required of the requested blood type', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minUnits?: number = 1;
}
