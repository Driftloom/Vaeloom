export interface NotionDatabase {
  id: string;
  title: string;
  url: string;
}

export interface NotionPage {
  id: string;
  url: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type NotionPropertyValues = Record<string, unknown>;
