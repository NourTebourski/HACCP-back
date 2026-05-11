import { IsUUID, IsArray, IsOptional, IsString, ValidateNested, Allow } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class SubmissionValueDto {
  @ApiProperty()
  @IsString()
  key: string;

  @ApiProperty()
  @Allow()
  value: string | number | boolean;
}

export class CreateSubmissionDto {
  @ApiProperty()
  @IsUUID()
  templateId: string;

  @ApiProperty({ type: [SubmissionValueDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmissionValueDto)
  values: SubmissionValueDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
