import { IsOptional, IsInt, Min, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class QueryJobDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  @ApiProperty({ required: false, enum: ['http', 'event'] })
  @IsOptional()
  @IsIn(['http', 'event'])
  type?: string;

  @ApiProperty({ required: false, enum: ['active', 'paused', 'disabled'] })
  @IsOptional()
  @IsIn(['active', 'paused', 'disabled'])
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;
}
