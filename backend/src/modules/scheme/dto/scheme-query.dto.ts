import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/** See ComplaintQueryDto — `forbidNonWhitelisted` requires every query param to be declared. */
export class SchemeQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'Insurance', description: 'Filter by scheme category' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;
}
