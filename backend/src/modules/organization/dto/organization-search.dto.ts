import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrgType } from '@prisma/client';
import { GeoSearchDto } from '../../../common/dto/pagination.dto';

export class OrganizationSearchDto extends GeoSearchDto {
  @ApiPropertyOptional({ enum: OrgType, description: 'Restrict to one kind of facility' })
  @IsOptional()
  @IsEnum(OrgType)
  type?: OrgType;
}
