import { IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExecutePluginDto {
  @ApiProperty({ required: false, type: Object, description: 'Input passed to the plugin' })
  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;

  @ApiProperty({ required: false, description: 'Override the code blob to execute' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ required: false, description: 'Execution timeout in milliseconds' })
  @IsOptional()
  timeoutMs?: number;
}
