/**
 * Common types for crawler implementations
 */

export interface CrawlerOptions {
  maxPages?: number;
  maxDepth?: number;
  timeout?: number;
  maxConcurrency?: number;
}

export interface ExtractedData {
  items: CrawlResult[];
  metadata: {
    originalUrl: string;
    totalPages: number;
    completedAt: string;
    executionTime: number;
  };
}

export interface CrawlResult {
  url: string;
  title: string;
  htmlContent: string;
  metadata: {
    statusCode: number;
    timestamp: string;
    [key: string]: unknown;
  };
}

export interface ICrawler {
  crawl(url: string, options?: CrawlerOptions): Promise<ExtractedData>;
  scrap(urls: string[], options?: CrawlerOptions): Promise<ExtractedData>;
}

