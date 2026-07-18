import type { UUID, ISO8601 } from './domain';

/**
 * A Workspace is the top-level tenant-isolation boundary for a user's data.
 * Every data table in the system is scoped by `workspaceId` (see Docs/Database/Schema.md).
 * At MVP, one user owns one or more workspaces; file 01 provisions an empty one at signup.
 */
export interface Workspace {
  id: UUID;
  userId: UUID;
  name: string;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}
