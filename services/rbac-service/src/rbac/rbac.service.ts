import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { DatabaseService } from '../database/database.service';
import { RequestContextService } from '../observability/request-context.service';
import {
  AddPermissionDto,
  CheckPermissionDto,
  CreateRoleDto,
  Permission,
  UpdateRoleDto,
} from './dto/rbac.dto';

export interface RoleRow {
  id: string;
  name: string;
  permissions: string;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly requestContext: RequestContextService,
  ) {}

  async listRoles() {
    const result = await this.db.query<RoleRow>(
      `SELECT * FROM rbac_roles ORDER BY created_at DESC`,
    );
    return result.rows;
  }

  async createRole(dto: CreateRoleDto) {
    const id = randomUUID();
    const permissions = dto.permissions ?? [];
    const result = await this.db.query<RoleRow>(
      `INSERT INTO rbac_roles (id, name, permissions) VALUES ($1, $2, $3::jsonb) RETURNING *`,
      [id, dto.name, JSON.stringify(permissions)],
    );
    this.logger.log({ roleId: id }, 'Role created');
    return result.rows[0]!;
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    const existing = await this.findRole(id);
    const name = dto.name ?? existing.name;
    const permissions = dto.permissions !== undefined ? dto.permissions : JSON.parse(existing.permissions);

    const result = await this.db.query<RoleRow>(
      `UPDATE rbac_roles SET name = $1, permissions = $2::jsonb, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [name, JSON.stringify(permissions), id],
    );
    return result.rows[0]!;
  }

  async deleteRole(id: string) {
    const result = await this.db.query(`DELETE FROM rbac_roles WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      throw new NotFoundException(`Role "${id}" not found`);
    }
    this.logger.log({ roleId: id }, 'Role deleted');
  }

  async addPermission(id: string, dto: AddPermissionDto) {
    const existing = await this.findRole(id);
    const permissions = JSON.parse(existing.permissions) as Permission[];
    const exists = permissions.some(
      (p) => p.resource === dto.permission.resource && p.action === dto.permission.action,
    );
    if (!exists) {
      permissions.push(dto.permission);
    }
    const result = await this.db.query<RoleRow>(
      `UPDATE rbac_roles SET permissions = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [JSON.stringify(permissions), id],
    );
    return result.rows[0]!;
  }

  async listRolePermissions(id: string) {
    const role = await this.findRole(id);
    return JSON.parse(role.permissions) as Permission[];
  }

  async checkPermission(dto: CheckPermissionDto) {
    const result = await this.db.query<{ permissions: string }>(
      `SELECT r.permissions::text as permissions
       FROM iam_user_roles ur
       JOIN rbac_roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [dto.userId],
    );

    const userPermissions: Permission[] = result.rows
      .map((r) => {
        try {
          return JSON.parse(r.permissions) as Permission[];
        } catch {
          return [];
        }
      })
      .flat();

    const granted = userPermissions.some(
      (p) => p.resource === dto.resource && p.action === dto.action,
    );

    return {
      userId: dto.userId,
      resource: dto.resource,
      action: dto.action,
      granted,
    };
  }

  private async findRole(id: string): Promise<RoleRow> {
    const result = await this.db.query<RoleRow>(
      `SELECT * FROM rbac_roles WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException(`Role "${id}" not found`);
    }
    return result.rows[0]!;
  }
}
