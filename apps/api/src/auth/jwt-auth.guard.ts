import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Drop-in guard for any protected endpoint: `@UseGuards(JwtAuthGuard)`.
 * Kept as a named class so the auth mechanism can evolve (e.g. add SSO, file 15)
 * without touching every controller.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
