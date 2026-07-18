import { IsOptional, IsString } from 'class-validator';

export class UsageQueryDto {
  @IsOptional()
  @IsString()
  metric?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
