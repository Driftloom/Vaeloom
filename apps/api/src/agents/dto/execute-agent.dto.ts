import { IsObject, IsOptional, IsString } from 'class-validator';

export class ExecuteAgentDto {
  @IsObject()
  input!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  channel?: string;
}
