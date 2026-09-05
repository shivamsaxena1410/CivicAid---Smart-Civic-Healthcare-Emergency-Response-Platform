import { Module } from '@nestjs/common';
import { LiveController } from './live.controller';
import { EnvironmentService } from './environment.service';
import { GeocodeService } from './geocode.service';
import { OverpassService } from './overpass.service';

/**
 * Third-party live data. Holds no Prisma dependency by design — nothing fetched
 * here is persisted, which is what keeps real facilities separate from the
 * simulated availability figures in the database.
 */
@Module({
  controllers: [LiveController],
  providers: [EnvironmentService, GeocodeService, OverpassService],
  exports: [EnvironmentService, GeocodeService, OverpassService],
})
export class LiveModule {}
