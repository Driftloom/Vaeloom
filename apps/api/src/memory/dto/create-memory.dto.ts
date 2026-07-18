import { IsArray, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMemoryDto {
  @IsString()
  @MaxLength(500)
  title!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
