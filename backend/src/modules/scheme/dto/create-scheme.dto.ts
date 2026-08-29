import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSchemeDto {
  @ApiProperty({ example: 'Ayushman Bharat — Pradhan Mantri Jan Arogya Yojana (PM-JAY)' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Universal tertiary hospitalization insurance coverage scheme.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'Families listed under SECC deprivation categories and BPL card holders.' })
  @IsString()
  @IsNotEmpty()
  eligibilityCriteria: string;

  @ApiProperty({ example: 'Up to ₹5,00,000 cashless cover per family per year.' })
  @IsString()
  @IsNotEmpty()
  benefits: string;

  @ApiPropertyOptional({ example: 'https://pmjay.gov.in' })
  @IsOptional()
  @IsString()
  applicationUrl?: string;

  @ApiPropertyOptional({ example: 'Universal Health Coverage', default: 'General' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: ['Aadhaar Card', 'Ration Card'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentsRequired?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
