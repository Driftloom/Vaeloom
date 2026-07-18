import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, timeout, retry, catchError } from 'rxjs';

interface SearchResult {
  id: string;
  text: string;
  score: number;
  source: string;
  metadata: Record<string, unknown>;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
}

@Injectable()
export class SearchService {
  private readonly memoryServiceUrl: string;
  private readonly kgServiceUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.memoryServiceUrl = this.config.get<string>('memoryServiceUrl') ?? 'http://localhost:8100';
    this.kgServiceUrl = this.config.get<string>('kgServiceUrl') ?? 'http://localhost:8300';
  }

  private async searchService(url: string, query: string, tenantId: string, limit?: number): Promise<SearchResult[]> {
    try {
      const res = await lastValueFrom(
        this.http.post<SearchResponse>(`${url}/search`, { query, tenantId, limit: limit ?? 10 }).pipe(
          timeout(5000),
          retry(1),
          catchError((err) => { throw err; }),
        ),
      );
      return res.data.results;
    } catch {
      return [];
    }
  }

  async searchAll(query: string, tenantId: string, sources?: string[], limit?: number): Promise<{ results: SearchResult[]; total: number }> {
    const searches: Promise<SearchResult[]>[] = [];

    if (!sources || sources.includes('memory')) {
      searches.push(this.searchService(this.memoryServiceUrl, query, tenantId, limit));
    }
    if (!sources || sources.includes('knowledge-graph')) {
      searches.push(this.searchService(this.kgServiceUrl, query, tenantId, limit));
    }

    const results = (await Promise.all(searches)).flat();
    results.sort((a, b) => b.score - a.score);

    const sliced = results.slice(0, limit ?? 20);
    return { results: sliced, total: results.length };
  }
}
