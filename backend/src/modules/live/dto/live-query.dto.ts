import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * Coordinates for a live lookup.
 *
 * These endpoints are reachable without authentication and cause the server to
 * make outbound HTTP requests, so the bounds here are a security control rather
 * than input hygiene: they keep the parameters inside the fixed set of upstream
 * URLs we construct and cap the work any one caller can ask for.
 */
export class LiveGeoQueryDto {
  @ApiProperty({ example: 12.9592 })
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 77.6499 })
  @Type(() => Number)
  @IsLongitude()
  lng: number;
}

export class LiveFacilityQueryDto extends LiveGeoQueryDto {
  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 25, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  // Capped well below the app's own search radius: Overpass cost grows with the
  // square of the radius, and a 50 km healthcare query in a dense city times out
  // on the public mirrors.
  @Max(25)
  radiusKm?: number = 5;
}
