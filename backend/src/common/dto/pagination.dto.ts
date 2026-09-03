import { IsOptional, IsInt, Min, Max, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Search term for keyword filtering' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by city (e.g. Bengaluru)' })
  @IsOptional()
  @IsString()
  city?: string;
}

export class GeoSearchDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Current latitude coordinate (e.g. 12.9716)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ description: 'Current longitude coordinate (e.g. 77.5946)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  /**
   * Bounded deliberately. This value is interpolated into a PostGIS
   * `ST_DWithin` call, and an unbounded radius turns every "nearby" lookup into
   * a full-table scan that also defeats the point of the search. `Min(0)` — not
   * `IsPositive` — because 0 km is a meaningful query ("exactly here") and must
   * not be silently treated as "no radius given".
   */
  @ApiPropertyOptional({ description: 'Search radius in kilometers (0-500)', default: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(500)
  radiusKm?: number = 15;
}
