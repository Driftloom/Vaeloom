import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { RequestContextService } from '../observability/request-context.service';
import {
  AssignRolesDto,
  CreateUserDto,
  ListUsersQueryDto,
  UpdateUserDto,
} from './dto/iam.dto';

export interface UserRow {
  id: string;
  email: string;
  display_name: string;
  tenant_id: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RoleRow {
  id: string;
  name: string;
}

@Injectable()
export class IamService {
  private readonly logger = new Logger(IamService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly requestContext: RequestContextService,
  ) {}

  async createUser(dto: CreateUserDto) {
    const id = randomUUID();
    const result = await this.db.query<UserRow>(
      `INSERT INTO iam_users (id, email, display_name, tenant_id, active)
       VALUES ($1, $2, $3, $4, TRUE) RETURNING *`,
      [id, dto.email, dto.displayName, dto.tenantId],
    );
    const user = result.rows[0]!;

    if (dto.roleIds && dto.roleIds.length > 0) {
      await this.assignRoleRecords(id, dto.roleIds);
    }

    return this.getUserWithRoles(user.id);
  }

  async listUsers(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (query.tenantId) {
      conditions.push(`tenant_id = $${idx}`);
      params.push(query.tenantId);
      idx++;
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM iam_users ${where}`,
      params,
    );
    const total = Number(countRes.rows[0]!.count);

    const data = await this.db.query<UserRow>(
      `SELECT * FROM iam_users ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, pageSize, offset],
    );

    const users = await Promise.all(data.rows.map((u) => this.getUserWithRoles(u.id)));
    return { data: users, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async getUser(id: string) {
    return this.getUserWithRoles(id);
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const existing = await this.findUserRow(id);
    const displayName = dto.displayName ?? existing.display_name;
    const email = dto.email ?? existing.email;
    const active = dto.active ?? existing.active;

    const result = await this.db.query<UserRow>(
      `UPDATE iam_users SET display_name = $1, email = $2, active = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [displayName, email, active, id],
    );
    return this.getUserWithRoles(result.rows[0]!.id);
  }

  async deactivateUser(id: string) {
    const result = await this.db.query(
      `UPDATE iam_users SET active = FALSE, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    if (result.rowCount === 0) {
      throw new NotFoundException(`User "${id}" not found`);
    }
    this.logger.log({ userId: id }, 'User deactivated');
  }

  async assignRoles(id: string, dto: AssignRolesDto) {
    await this.findUserRow(id);
    await this.assignRoleRecords(id, dto.roleIds);
    return this.getUserWithRoles(id);
  }

  async removeRole(id: string, roleId: string) {
    await this.findUserRow(id);
    const result = await this.db.query(
      `DELETE FROM iam_user_roles WHERE user_id = $1 AND role_id = $2`,
      [id, roleId],
    );
    if (result.rowCount === 0) {
      throw new NotFoundException(`Role "${roleId}" not assigned to user "${id}"`);
    }
    this.logger.log({ userId: id, roleId }, 'Role removed from user');
  }

  async getPermissions(id: string) {
    await this.findUserRow(id);
    const result = await this.db.query<{ permission: string }>(
      `SELECT DISTINCT r.permissions::text as permission
       FROM iam_user_roles ur
       JOIN rbac_roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [id],
    );
    const permissions = result.rows
      .map((r) => {
        try {
          return JSON.parse(r.permission) as Array<{
            resource: string;
            action: string;
            conditions?: Record<string, unknown>;
          }>;
        } catch {
          return [];
        }
      })
      .flat();
    return { userId: id, permissions };
  }

  private async assignRoleRecords(userId: string, roleIds: string[]): Promise<void> {
    for (const roleId of roleIds) {
      const roleRes = await this.db.query<RoleRow>(
        `SELECT id, name FROM rbac_roles WHERE id = $1`,
        [roleId],
      );
      if (roleRes.rows.length === 0) {
        throw new BadRequestException(`Role "${roleId}" does not exist`);
      }
      await this.db.query(
        `INSERT INTO iam_user_roles (user_id, role_id) VALUES ($1, $2)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [userId, roleId],
      );
    }
  }

  private async findUserRow(id: string): Promise<UserRow> {
    const result = await this.db.query<UserRow>(
      `SELECT * FROM iam_users WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException(`User "${id}" not found`);
    }
    return result.rows[0]!;
  }

  private async getUserWithRoles(id: string) {
    const user = await this.findUserRow(id);
    const rolesRes = await this.db.query<RoleRow>(
      `SELECT r.id, r.name FROM iam_user_roles ur
       JOIN rbac_roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [id],
    );
    return {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      tenantId: user.tenant_id,
      active: user.active,
      roles: rolesRes.rows,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }
}
