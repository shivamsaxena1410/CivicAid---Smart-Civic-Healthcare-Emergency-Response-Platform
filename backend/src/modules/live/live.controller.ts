import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { EnvironmentService } from './environment.service';
import { GeocodeService } from './geocode.service';
import { OverpassService } from './overpass.service';
import { LiveFacilityQueryDto, LiveGeoQueryDto } from './dto/live-query.dto';

/**
 * Aggregation layer for genuinely live, third-party data.
 *
 * Everything here is real: OpenStreetMap facilities, Open-Meteo observations,
 * Nominatim place names. Nothing here reports availability — beds, blood units
 * and medicine stock are simulated demo data and are served by their own
 * modules, badged as such.
 *
 * The routes are @Public() because a citizen must be able to find a hospital or
 * check the air they are breathing without holding an account. They are also
 * the only public routes that make the server perform outbound HTTP, so each is
 * throttled well below the global bucket: an unauthenticated caller must not be
 * able to turn this API into an amplifier aimed at a volunteer-run service.
 */
@ApiTags('Live Data')
@Controller('live')
export class LiveController {
  constructor(
    private readonly environment: EnvironmentService,
    private readonly geocode: GeocodeService,
    private readonly overpass: OverpassService,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('environment')
  @ApiOperation({
    summary: 'Live weather and air quality for a point (Open-Meteo), with its place name',
  })
  async getEnvironment(@Query() query: LiveGeoQueryDto) {
    const place = await this.geocode.reverse(query.lat, query.lng);
    const environment = await this.environment.get(query.lat, query.lng, place.label);
    return { ...environment, place, sources: ['Open-Meteo', 'Nominatim / OpenStreetMap'] };
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('geocode/reverse')
  @ApiOperation({ summary: 'Resolve coordinates to a place name (Nominatim / OpenStreetMap)' })
  async reverseGeocode(@Query() query: LiveGeoQueryDto) {
    return this.geocode.reverse(query.lat, query.lng);
  }

  @Public()
  // Tighter than the others: an Overpass query is by far the most expensive
  // thing this API asks of an external service.
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  @Get('facilities')
  @ApiOperation({
    summary: 'Real healthcare facilities near a point from OpenStreetMap. No availability data.',
  })
  async getFacilities(@Query() query: LiveFacilityQueryDto) {
    return this.overpass.findNearby(query.lat, query.lng, query.radiusKm ?? 5);
  }
}
