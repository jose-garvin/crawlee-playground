/**
 * Type definitions for benchmark operations
 */

export interface BenchmarkConfig {
  url: string;
  maxPages?: number;
  maxDepth?: number;
  iterations?: number;
  timeout?: number;
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

export interface BenchmarkMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  pagesProcessed: number;
  pagesFailed: number;
  memoryUsed?: number;
  errors: string[];
}

export interface BenchmarkResult {
  crawlerType: "playwright" | "cheerio";
  config: BenchmarkConfig;
  metrics: BenchmarkMetrics;
  results: CrawlResult[];
  iteration: number;
}

export interface ComparisonResult {
  playwright: BenchmarkResult;
  cheerio: BenchmarkResult;
  speedup: number;
  memoryDifference: number;
  pagesDifference: number;
}

export interface BenchmarkReport {
  timestamp: string;
  config: BenchmarkConfig;
  results: BenchmarkResult[];
  comparison?: ComparisonResult;
}

