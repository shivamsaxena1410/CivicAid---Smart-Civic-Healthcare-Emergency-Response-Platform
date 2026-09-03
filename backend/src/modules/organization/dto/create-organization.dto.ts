import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsEmail,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { OrgType } from '@prisma/client';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'DEMO — Northside General Hospital' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({ enum: OrgType, example: OrgType.HOSPITAL })
  @IsEnum(OrgType)
  @IsNotEmpty()
  type: OrgType;

  @ApiPropertyOptional({ example: 'Primary outpatient clinic and pathology laboratory.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: '12th Main Rd, Indiranagar' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  address: string;

  @ApiProperty({ example: 'Bengaluru' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city: string;

  @ApiProperty({ example: 'Karnataka' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  state: string;

  @ApiProperty({ example: '560038' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'pincode must be a 6-digit Indian PIN code' })
  pincode: string;

  /**
   * Bounded to real coordinates. These feed the PostGIS `location` generated
   * column; an out-of-range value produces a point that no proximity search can
   * ever match, so the facility silently disappears from every nearby lookup.
   */
  @ApiProperty({ example: 12.9784 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsNotEmpty()
  latitude: number;

  @ApiProperty({ example: 77.6408 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsNotEmpty()
  longitude: number;

  @ApiProperty({ example: '+91 80 5550 0001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone: string;

  @ApiProperty({ example: 'contact@northside-general.example.invalid' })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(320)
  email: string;

  @ApiPropertyOptional({ example: 'https://northside-general.example.invalid' })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  website?: string;

  @ApiPropertyOptional({ example: 'DEMO-CLINIC-2026-551' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  licenseNumber?: string;
}

/**
 * See UpdateSchemeDto for why this is PartialType() and not Partial<T>.
 *
 * `type` is omitted: an organisation's kind determines which detail tables and
 * which role guards apply to it, so allowing it to be edited would let an
 * approved pharmacy become an approved hospital and start publishing ICU bed
 * counts without any review.
 */
export class UpdateOrganizationDto extends PartialType(OmitType(CreateOrganizationDto, ['type'] as const)) {}
