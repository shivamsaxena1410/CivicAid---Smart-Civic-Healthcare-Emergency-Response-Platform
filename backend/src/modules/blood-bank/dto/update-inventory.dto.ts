import { IsArray, IsEnum, IsInt, IsNotEmpty, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { BloodType } from '@prisma/client';

export class BloodInventoryItemDto {
  @ApiProperty({ enum: BloodType, example: BloodType.O_POSITIVE })
  @IsEnum(BloodType)
  @IsNotEmpty()
  bloodType: BloodType;

  @ApiProperty({ example: 45 })
  @IsInt()
  @Min(0)
  unitsAvailable: number;
}

export class UpdateBloodInventoryDto {
  @ApiProperty({ type: [BloodInventoryItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BloodInventoryItemDto)
  inventory: BloodInventoryItemDto[];
}
