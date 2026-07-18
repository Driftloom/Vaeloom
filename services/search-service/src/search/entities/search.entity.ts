import { Expose, Type } from 'class-transformer';

export class SearchResultItem {
  @Expose()
  id!: string;

  @Expose()
  sourceType!: 'memory' | 'knowledge';

  @Expose()
  title!: string;

  @Expose()
  snippet?: string;

  @Expose()
  score!: number;

  @Expose()
  tenantId!: string;

  @Expose()
  tags!: string[];

  @Expose()
  @Type(() => Date)
  createdAt!: Date;
}

export class SuggestionItem {
  @Expose()
  title!: string;

  @Expose()
  sourceType!: 'memory' | 'knowledge';

  @Expose()
  count!: number;
}

export class FeedbackResponse {
  @Expose()
  id!: string;

  @Expose()
  message!: string;
}
