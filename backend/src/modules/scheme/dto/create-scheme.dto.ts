import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateSchemeDto {
  @ApiProperty({ example: 'Ayushman Bharat — Pradhan Mantri Jan Arogya Yojana (PM-JAY)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title: string;

  @ApiProperty({ example: 'Universal tertiary hospitalization insurance coverage scheme.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;

  @ApiProperty({ example: 'Families listed under SECC deprivation categories and BPL card holders.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  eligibilityCriteria: string;

  @ApiProperty({ example: 'Up to ₹5,00,000 cashless cover per family per year.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  benefits: string;

  /**
   * Validated as a URL, not merely as a string. This value is rendered as a
   * link that citizens are told to use to apply for a government benefit, so an
   * unvalidated string here is a phishing vector with official framing.
   */
  @ApiPropertyOptional({ example: 'https://pmjay.gov.in' })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  applicationUrl?: string;

  @ApiPropertyOptional({ example: 'Universal Health Coverage', default: 'General' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @ApiPropertyOptional({ example: ['Aadhaar Card', 'Ration Card'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  documentsRequired?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

/**
 * `PartialType()`, not `Partial<CreateSchemeDto>`.
 *
 * `Partial<T>` is a TypeScript-only mapped type. It leaves no class behind, so
 * the parameter's emitted `design:type` metadata is `Object` — and
 * `ValidationPipe.toValidate()` explicitly skips `Object`, along with the other
 * native types. The result is that a body typed `Partial<CreateSchemeDto>` was
 * not validated at all: no type checks, no length limits, and `whitelist`
 * stripping never ran, so unknown properties passed straight through to the
 * service.
 *
 * `PartialType()` builds a real class at runtime and copies the validation
 * metadata across with every rule marked optional, which is what makes the pipe
 * engage.
 */
export class UpdateSchemeDto extends PartialType(CreateSchemeDto) {}
