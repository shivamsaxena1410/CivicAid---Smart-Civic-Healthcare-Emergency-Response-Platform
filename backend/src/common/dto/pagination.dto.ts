import { IsOptional, IsPositive, IsInt, Min, Max, IsString, IsNumber } from 'class-validator';
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
  lat?: number;

  @ApiPropertyOptional({ description: 'Current longitude coordinate (e.g. 77.5946)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ description: 'Search radius in kilometers', default: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  radiusKm?: number = 15;
}
