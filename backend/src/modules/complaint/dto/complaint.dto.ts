import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComplaintStatus } from '@prisma/client';

export class CreateComplaintDto {
  @ApiPropertyOptional({ description: 'Specific hospital/pharmacy/ambulance organization ID' })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiProperty({ example: 'Emergency Triage Delay / Refusal to Admit' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ example: 'Waited over 45 minutes with acute trauma without triage attendance.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 'https://storage.civicconnect.org/evidence/report1.pdf' })
  @IsOptional()
  @IsString()
  attachmentUrl?: string;
}

export class ResolveComplaintDto {
  @ApiProperty({ enum: ComplaintStatus, example: ComplaintStatus.RESOLVED })
  @IsEnum(ComplaintStatus)
  @IsNotEmpty()
  status: ComplaintStatus;

  @ApiProperty({ example: 'Hospital administration issued warning to on-duty triage registrar and reimbursed extra charges.' })
  @IsString()
  @IsNotEmpty()
  resolutionNotes: string;
}
