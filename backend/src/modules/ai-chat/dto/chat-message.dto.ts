import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty({ example: 'What are the early warning signs of heatstroke and which nearby hospital has an active emergency room in Bengaluru?' })
  @IsString()
  @IsNotEmpty({ message: 'Message query cannot be empty.' })
  @MaxLength(1000, { message: 'Query must be under 1000 characters.' })
  message: string;
}
