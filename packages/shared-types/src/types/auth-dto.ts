import type { UUID, ISO8601, Email } from './domain';
import type { Workspace } from './workspace';

/**
 * Wire contracts shared between apps/web and apps/api for the auth scaffold (file 01).
 * The api implements these with class-validator DTOs; the web imports them for typed calls.
 * Keeping them here satisfies the acceptance criterion: no type duplication between web and api.
 */

/** Public (safe) representation of a user — never includes the password hash. */
export interface PublicUser {
  id: UUID;
  email: Email;
  displayName: string;
  authProvider: string;
  createdAt: ISO8601;
}

export interface SignupRequest {
  email: Email;
  password: string;
  displayName?: string;
}

export interface LoginRequest {
  email: Email;
  password: string;
}

/** Returned by both signup and login: the session token plus the authenticated user. */
export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: PublicUser;
}

export interface CreateWorkspaceRequest {
  name?: string;
}

/** JWT payload signed by the api and verified by the JwtStrategy. */
export interface JwtPayload {
  sub: UUID;
  email: Email;
}

export interface MeResponse {
  user: PublicUser;
  workspaces: Workspace[];
}
