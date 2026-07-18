import type { CreateWorkspaceRequest } from '@vaeloom/shared-types';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWorkspaceDto implements CreateWorkspaceRequest {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
