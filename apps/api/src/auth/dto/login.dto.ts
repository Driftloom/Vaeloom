import type { LoginRequest } from '@vaeloom/shared-types';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class LoginDto implements LoginRequest {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}
