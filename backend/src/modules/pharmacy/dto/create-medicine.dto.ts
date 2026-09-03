import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateMedicineDto {
  @ApiProperty({ example: 'Paracetamol 650 mg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  medicineName: string;

  @ApiPropertyOptional({ example: 'Paracetamol' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  genericName?: string;

  @ApiPropertyOptional({ example: 'Analgesic / Antipyretic' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @ApiProperty({ example: 32.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  price: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  inStock?: boolean = true;

  @ApiPropertyOptional({ example: 200, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number = 0;
}

/** See UpdateSchemeDto for why this is PartialType() and not Partial<T>. */
export class UpdateMedicineDto extends PartialType(CreateMedicineDto) {}
