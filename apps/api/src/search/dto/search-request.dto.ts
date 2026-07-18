import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchRequestDto {
  @IsString()
  query!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sources?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;
}
