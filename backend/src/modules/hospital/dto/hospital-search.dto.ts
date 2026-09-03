import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { GeoSearchDto } from '../../../common/dto/pagination.dto';
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator';

/**
 * Hospital search filters.
 *
 * These were previously declared as loose `@Query('icuOnly')` parameters typed
 * `boolean` and coerced in the controller with `String(x) === 'true'`. Because
 * they were not part of a validated DTO, `whitelist` never applied to them and
 * an arbitrary value was accepted; `@ToBoolean()` now parses them properly and
 * `@IsBoolean()` rejects anything that is not a boolean.
 */
export class HospitalSearchDto extends GeoSearchDto {
  @ApiPropertyOptional({ description: 'Only hospitals reporting at least one free ICU bed' })
  @ToBoolean()
  @IsBoolean()
  @IsOptional()
  icuOnly?: boolean;

  @ApiPropertyOptional({ description: 'Only hospitals with an operational emergency department' })
  @ToBoolean()
  @IsBoolean()
  @IsOptional()
  emergencyOnly?: boolean;

  @ApiPropertyOptional({ description: 'Only hospitals reporting oxygen support' })
  @ToBoolean()
  @IsBoolean()
  @IsOptional()
  oxygenOnly?: boolean;

  @ApiPropertyOptional({ description: 'Only hospitals reporting ventilators' })
  @ToBoolean()
  @IsBoolean()
  @IsOptional()
  ventilatorOnly?: boolean;

  @ApiPropertyOptional({ description: 'Filter by department, e.g. Cardiology' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;
}
