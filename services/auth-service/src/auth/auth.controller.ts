import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthedUser } from './strategies/jwt.strategy';

class LogoutDto {
  @IsUUID()
  sessionId!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user and provision their first workspace' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password, dto.displayName);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue a new JWT pair using a refresh token' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.sessionId, dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a session' })
  async logout(@Body() dto: LogoutDto): Promise<void> {
    await this.auth.logout(dto.sessionId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the authenticated user and their workspaces' })
  me(@CurrentUser() authed: AuthedUser) {
    return this.auth.getProfile(authed.id);
  }

  @Post('api-keys')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new API key' })
  createApiKey(@CurrentUser() authed: AuthedUser, @Body() dto: CreateApiKeyDto) {
    return this.auth.createApiKey(authed.id, dto.name, dto.permissions);
  }

  @Get('api-keys')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all active API keys for the current user' })
  listApiKeys(@CurrentUser() authed: AuthedUser) {
    return this.auth.listApiKeys(authed.id);
  }

  @Delete('api-keys/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke an API key' })
  async revokeApiKey(@Param('id') id: string): Promise<void> {
    await this.auth.revokeApiKey(id);
  }
}
