import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ComplaintStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * `status` belongs on the DTO, not on a separate `@Query('status')` parameter.
 *
 * With `forbidNonWhitelisted: true`, the whole query object is validated
 * against the type of the `@Query()` parameter — a param the DTO does not
 * declare is now rejected as an unknown property rather than silently ignored.
 */
export class ComplaintQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ComplaintStatus })
  @IsOptional()
  @IsEnum(ComplaintStatus)
  status?: ComplaintStatus;
}
