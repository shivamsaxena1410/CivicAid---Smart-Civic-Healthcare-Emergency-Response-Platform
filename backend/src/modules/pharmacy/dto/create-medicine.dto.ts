import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMedicineDto {
  @ApiProperty({ example: 'Paracetamol 650mg (Dolo 650)' })
  @IsString()
  @IsNotEmpty()
  medicineName: string;

  @ApiPropertyOptional({ example: 'Paracetamol' })
  @IsOptional()
  @IsString()
  genericName?: string;

  @ApiPropertyOptional({ example: 'Analgesic / Antipyretic' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ example: 32.5 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  inStock?: boolean = true;

  @ApiPropertyOptional({ example: 200, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number = 0;
}
