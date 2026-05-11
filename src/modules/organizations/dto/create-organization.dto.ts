import { IsString, IsNotEmpty, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Demo Restaurant GmbH' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Musterstraße 1, 10115 Berlin' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '+49 30 123456' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'info@demo-restaurant.de' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
