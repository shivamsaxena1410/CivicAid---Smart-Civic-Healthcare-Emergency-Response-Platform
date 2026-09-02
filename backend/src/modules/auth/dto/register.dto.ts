import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

/**
 * Roles a caller may assign to themselves through the public registration
 * endpoint.
 *
 * ADMIN and AUTHORITY are deliberately absent. The inherited DTO validated
 * `role` with `@IsEnum(Role)`, which accepts the *entire* enum — so an
 * unauthenticated `POST /auth/register {"role":"ADMIN"}` created a platform
 * administrator. AUTHORITY was equally exposed and can publish public health
 * alerts and resolve citizen grievances.
 *
 * These two roles are provisioned by the seed / by an existing ADMIN only.
 * Organization roles remain self-registerable because they are worthless until
 * an ADMIN approves their KYC (VerificationStatus.APPROVED) — the platform's
 * trust boundary is verification, not registration.
 */
export const SELF_REGISTERABLE_ROLES: readonly Role[] = [
  Role.CITIZEN,
  Role.HOSPITAL,
  Role.BLOOD_BANK,
  Role.PHARMACY,
  Role.AMBULANCE,
  Role.NGO,
];

export class RegisterDto {
  @ApiProperty({ example: 'citizen@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Password123!', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: 'Priya Sundaram' })
  @IsString()
  @IsNotEmpty({ message: 'Full name is required.' })
  name: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    enum: SELF_REGISTERABLE_ROLES,
    default: Role.CITIZEN,
    description:
      'Account type. ADMIN and AUTHORITY cannot be self-assigned and are rejected with 400. Organization accounts still require admin KYC approval before they can publish data.',
  })
  @IsOptional()
  @IsEnum(Role, { message: 'Invalid role selection.' })
  @IsIn(SELF_REGISTERABLE_ROLES, {
    message: 'This role cannot be self-assigned. Administrator and authority accounts are provisioned internally.',
  })
  role?: Role = Role.CITIZEN;
}
