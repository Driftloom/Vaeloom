import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateIntegrationDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  provider!: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
