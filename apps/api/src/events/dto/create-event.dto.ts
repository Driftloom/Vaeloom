import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateEventDto {
  @IsString()
  type!: string;

  @IsString()
  source!: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
