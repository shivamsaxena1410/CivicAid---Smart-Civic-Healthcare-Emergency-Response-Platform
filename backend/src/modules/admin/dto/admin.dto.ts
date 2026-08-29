import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VerificationStatus } from '@prisma/client';

export class VerifyOrganizationDto {
  @ApiProperty({ enum: VerificationStatus, example: VerificationStatus.APPROVED })
  @IsEnum(VerificationStatus)
  @IsNotEmpty()
  status: VerificationStatus;

  @ApiPropertyOptional({ example: 'State medical council license verified.' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class ToggleUserStatusDto {
  @ApiProperty({ example: true })
  @IsNotEmpty()
  isActive: boolean;
}
