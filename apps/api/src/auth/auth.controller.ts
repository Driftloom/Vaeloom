import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthResponse, MeResponse } from '@vaeloom/shared-types';

import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthedUser } from './jwt.strategy';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
  ) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user and provision their first workspace' })
  signup(@Body() dto: SignupDto): Promise<AuthResponse> {
    return this.auth.signup(dto.email, dto.password, dto.displayName);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the authenticated user and their workspaces' })
  async me(@CurrentUser() authed: AuthedUser): Promise<MeResponse> {
    const [user, workspaces] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: authed.id } }),
      this.workspaces.listForUser(authed.id),
    ]);
    return { user: AuthService.toPublicUser(user), workspaces };
  }
}
