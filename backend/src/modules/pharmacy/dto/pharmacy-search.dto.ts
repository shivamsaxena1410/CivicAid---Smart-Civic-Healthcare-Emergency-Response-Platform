import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { GeoSearchDto } from '../../../common/dto/pagination.dto';
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator';

export class PharmacySearchDto extends GeoSearchDto {
  @ApiPropertyOptional({ description: 'Only include medicines currently in stock' })
  @ToBoolean()
  @IsBoolean()
  @IsOptional()
  inStockOnly?: boolean;
}

export class MedicineSearchDto extends PharmacySearchDto {
  @ApiPropertyOptional({ description: 'Brand or product name, e.g. Paracetamol 650 mg' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  medicineName?: string;

  @ApiPropertyOptional({ description: 'Generic (INN) name, e.g. Paracetamol' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  genericName?: string;
}
