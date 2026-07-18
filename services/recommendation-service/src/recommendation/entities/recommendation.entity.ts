import { Expose, Transform, Type } from 'class-transformer';

export class RecommendationItem {
  @Expose()
  id!: string;

  @Expose()
  type!: string;

  @Expose()
  title!: string;

  @Expose()
  summary?: string;

  @Expose()
  score!: number;

  @Expose()
  source!: string;

  @Expose()
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  metadata?: Record<string, unknown>;
}

export class RecommendationResponse {
  @Expose()
  id!: string;

  @Expose()
  userId!: string;

  @Expose()
  tenantId!: string;

  @Expose()
  @Type(() => RecommendationItem)
  items!: RecommendationItem[];

  @Expose()
  modelVersion?: string;

  @Expose()
  @Type(() => Date)
  createdAt!: Date;
}

export class TrendingResponse {
  @Expose()
  id!: string;

  @Expose()
  type!: string;

  @Expose()
  title!: string;

  @Expose()
  usageCount!: number;
}

export interface RecommendationRow {
  id: string;
  user_id: string;
  tenant_id: string;
  items: string;
  model_version: string | null;
  created_at: Date;
}

export interface FeedbackRow {
  id: string;
  recommendation_id: string;
  user_id: string;
  tenant_id: string;
  useful: boolean;
  created_at: Date;
}

export interface PreferenceVectorRow {
  user_id: string;
  tenant_id: string;
  preference_vector: string;
  updated_at: Date;
}
