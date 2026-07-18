import { IsArray, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAgentDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];
}
