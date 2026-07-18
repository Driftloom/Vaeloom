import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { DatabaseService } from '../database/database.service';
import { CreateEdgeDto } from './dto/create-edge.dto';
import { CreateNodeDto } from './dto/create-node.dto';
import { QueryEdgeDto, QueryNodeDto, ShortestPathDto, TraverseDto } from './dto/query-edge.dto';
import { UpdateNodeDto } from './dto/update-node.dto';

@Injectable()
export class KnowledgeGraphService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async createNode(dto: CreateNodeDto) {
    const id = randomUUID();
    const embedding = await this.computeEmbedding(dto.label, dto.description);

    const { rows } = await this.db.query(
      `INSERT INTO knowledge_nodes (id, label, type, description, importance, properties, embedding, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8) RETURNING *`,
      [
        id,
        dto.label,
        dto.type,
        dto.description ?? null,
        dto.importance ?? 0.5,
        JSON.stringify(dto.properties ?? {}),
        embedding,
        dto.tenantId,
      ],
    );
    return rows[0];
  }

  async findAllNodes(query: QueryNodeDto) {
    const { page = 1, pageSize = 20, type, search, minImportance, maxImportance, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (type) {
      conditions.push(`type = $${idx++}`);
      params.push(type);
    }
    if (search) {
      conditions.push(`label ILIKE $${idx++}`);
      params.push(`%${search}%`);
    }
    if (minImportance !== undefined) {
      conditions.push(`importance >= $${idx++}`);
      params.push(minImportance);
    }
    if (maxImportance !== undefined) {
      conditions.push(`importance <= $${idx++}`);
      params.push(maxImportance);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const allowedSortColumns: Record<string, string> = { createdAt: 'created_at', label: 'label', importance: 'importance' };
    const sortColumn = allowedSortColumns[sortBy] ?? 'created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM knowledge_nodes ${where}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const { rows } = await this.db.query(
      `SELECT * FROM knowledge_nodes ${where} ORDER BY ${sortColumn} ${order} LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, pageSize, offset],
    );

    return {
      data: rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page * pageSize < total,
        hasPrevious: page > 1,
      },
    };
  }

  async findNodeById(id: string) {
    const { rows } = await this.db.query(
      `SELECT kn.*, (SELECT COUNT(*) FROM knowledge_edges WHERE source_id = kn.id OR target_id = kn.id)::int AS edge_count
       FROM knowledge_nodes kn WHERE kn.id = $1`,
      [id],
    );
    if (rows.length === 0) throw new NotFoundException(`Node ${id} not found`);
    return rows[0];
  }

  async updateNode(id: string, dto: UpdateNodeDto) {
    const existing = await this.findNodeById(id);

    const label = dto.label ?? existing.label;
    const description = dto.description ?? existing.description;
    const needsRecompute = dto.label !== undefined || dto.description !== undefined;
    let embedding = existing.embedding;
    if (needsRecompute) {
      embedding = await this.computeEmbedding(label, description);
    }

    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (dto.label !== undefined) { fields.push(`label = $${idx++}`); params.push(dto.label); }
    if (dto.type !== undefined) { fields.push(`type = $${idx++}`); params.push(dto.type); }
    if (dto.description !== undefined) { fields.push(`description = $${idx++}`); params.push(dto.description); }
    if (dto.importance !== undefined) { fields.push(`importance = $${idx++}`); params.push(dto.importance); }
    if (dto.properties !== undefined) { fields.push(`properties = $${idx++}`); params.push(JSON.stringify(dto.properties)); }
    if (needsRecompute) { fields.push(`embedding = $${idx++}::vector`); params.push(embedding); }

    if (fields.length === 0) return existing;

    params.push(id);
    const { rows } = await this.db.query(
      `UPDATE knowledge_nodes SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      params,
    );
    return rows[0];
  }

  async deleteNode(id: string) {
    await this.findNodeById(id);
    await this.db.query('DELETE FROM knowledge_edges WHERE source_id = $1 OR target_id = $1', [id]);
    await this.db.query('DELETE FROM knowledge_nodes WHERE id = $1', [id]);
    return { deleted: true };
  }

  async createEdge(sourceId: string, dto: CreateEdgeDto) {
    const source = await this.db.query('SELECT id FROM knowledge_nodes WHERE id = $1', [sourceId]);
    if (source.rows.length === 0) throw new NotFoundException(`Source node ${sourceId} not found`);

    const target = await this.db.query('SELECT id FROM knowledge_nodes WHERE id = $1', [dto.targetId]);
    if (target.rows.length === 0) throw new NotFoundException(`Target node ${dto.targetId} not found`);

    const existing = await this.db.query(
      'SELECT id FROM knowledge_edges WHERE source_id = $1 AND target_id = $2 AND relationship = $3',
      [sourceId, dto.targetId, dto.relationship],
    );
    if (existing.rows.length > 0) throw new ConflictException(`Edge already exists between these nodes with relationship "${dto.relationship}"`);

    const id = randomUUID();
    const { rows } = await this.db.query(
      `INSERT INTO knowledge_edges (id, source_id, target_id, relationship, weight, properties)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, sourceId, dto.targetId, dto.relationship, dto.weight ?? 1.0, JSON.stringify(dto.properties ?? {})],
    );
    return rows[0];
  }

  async findEdgesByNode(nodeId: string, query: QueryEdgeDto) {
    const { page = 1, pageSize = 20, sortOrder = 'desc' } = query;
    const offset = (page - 1) * pageSize;
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const countResult = await this.db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM knowledge_edges WHERE source_id = $1 OR target_id = $1',
      [nodeId],
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const { rows } = await this.db.query(
      `SELECT ke.*, s.id AS source_id_alias, s.label AS source_label, s.type AS source_type,
              t.id AS target_id_alias, t.label AS target_label, t.type AS target_type
       FROM knowledge_edges ke
       JOIN knowledge_nodes s ON s.id = ke.source_id
       JOIN knowledge_nodes t ON t.id = ke.target_id
       WHERE ke.source_id = $1 OR ke.target_id = $1
       ORDER BY ke.created_at ${order} LIMIT $2 OFFSET $3`,
      [nodeId, pageSize, offset],
    );

    return {
      data: rows.map(this.mapEdgeWithNodes),
      meta: {
        page, pageSize, total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page * pageSize < total,
        hasPrevious: page > 1,
      },
    };
  }

  async findAllEdges(query: QueryEdgeDto) {
    const { page = 1, pageSize = 20, relationship, sortOrder = 'desc' } = query;
    const offset = (page - 1) * pageSize;
    const params: unknown[] = [];
    let idx = 1;
    let where = '';

    if (relationship) {
      where = `WHERE ke.relationship = $${idx++}`;
      params.push(relationship);
    }

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM knowledge_edges ke ${where}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
    params.push(pageSize, offset);
    const { rows } = await this.db.query(
      `SELECT ke.*, s.id AS source_id_alias, s.label AS source_label, s.type AS source_type,
              t.id AS target_id_alias, t.label AS target_label, t.type AS target_type
       FROM knowledge_edges ke
       JOIN knowledge_nodes s ON s.id = ke.source_id
       JOIN knowledge_nodes t ON t.id = ke.target_id
       ${where}
       ORDER BY ke.created_at ${order} LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );

    return {
      data: rows.map(this.mapEdgeWithNodes),
      meta: {
        page, pageSize, total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page * pageSize < total,
        hasPrevious: page > 1,
      },
    };
  }

  async deleteEdge(id: string) {
    const { rows } = await this.db.query('DELETE FROM knowledge_edges WHERE id = $1 RETURNING id', [id]);
    if (rows.length === 0) throw new NotFoundException(`Edge ${id} not found`);
    return { deleted: true };
  }

  async traverse(dto: TraverseDto) {
    const { startId, depth = 3, mode = 'bfs' } = dto;

    const { rows } = await this.db.query(
      `WITH RECURSIVE path AS (
        SELECT id, label, type, description, importance, properties, tenant_id, created_at, updated_at,
               ARRAY[id] AS path_ids, 0 AS lvl
        FROM knowledge_nodes WHERE id = $1
        UNION ALL
        SELECT DISTINCT ON (e.target_id)
               n.id, n.label, n.type, n.description, n.importance, n.properties,
               n.tenant_id, n.created_at, n.updated_at,
               p.path_ids || n.id, p.lvl + 1
        FROM path p
        JOIN knowledge_edges e ON e.source_id = p.id
        JOIN knowledge_nodes n ON n.id = e.target_id
        WHERE p.lvl < $2 AND NOT n.id = ANY(p.path_ids)
      )
      SELECT * FROM path ORDER BY ${mode === 'dfs' ? 'lvl DESC' : 'lvl ASC'}`,
      [startId, depth],
    );

    return { nodes: rows, depth, mode };
  }

  async findShortestPath(dto: ShortestPathDto) {
    const { fromId, toId, maxDepth = 5 } = dto;

    const { rows } = await this.db.query(
      `WITH RECURSIVE search_path AS (
        SELECT id, ARRAY[id] AS path_ids, 0 AS depth
        FROM knowledge_nodes WHERE id = $1
        UNION ALL
        SELECT DISTINCT ON (e.target_id) e.target_id, sp.path_ids || e.target_id, sp.depth + 1
        FROM search_path sp
        JOIN knowledge_edges e ON e.source_id = sp.id
        WHERE sp.depth < $2 AND NOT e.target_id = ANY(sp.path_ids)
      ),
      found AS (
        SELECT path_ids, depth FROM search_path WHERE id = $3
      )
      SELECT path_ids, depth FROM found ORDER BY depth LIMIT 1`,
      [fromId, maxDepth, toId],
    );

    if (rows.length === 0) {
      return { path: null, message: 'No path found within max depth' };
    }

    const pathIds = rows[0].path_ids;
    const { rows: nodes } = await this.db.query(
      `SELECT id, label, type FROM knowledge_nodes WHERE id = ANY($1::uuid[]) ORDER BY array_position($1::uuid[], id)`,
      [pathIds],
    );

    return { path: nodes, depth: rows[0].depth, nodeCount: nodes.length };
  }

  private async computeEmbedding(label: string, description?: string): Promise<string> {
    const aiUrl = this.config.get<string>('app.aiServiceUrl');
    const text = description ? `${label}: ${description}` : label;
    try {
      const response = await fetch(`${aiUrl}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error(`AI service returned ${response.status}`);
      const result = (await response.json()) as { embedding: number[] };
      return `[${result.embedding.join(',')}]`;
    } catch {
      return Array(1536).fill(0).join(',');
    }
  }

  private mapEdgeWithNodes(row: Record<string, unknown>) {
    return {
      id: row.id,
      sourceId: row.source_id,
      targetId: row.target_id,
      relationship: row.relationship,
      weight: row.weight,
      properties: row.properties,
      createdAt: row.created_at,
      source: {
        id: row.source_id_alias || row.source_id,
        label: row.source_label,
        type: row.source_type,
      },
      target: {
        id: row.target_id_alias || row.target_id,
        label: row.target_label,
        type: row.target_type,
      },
    };
  }
}
