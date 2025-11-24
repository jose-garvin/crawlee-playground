/**
 * Benchmark report generator
 */

import type { BenchmarkResult, BenchmarkConfig, BenchmarkReport, ComparisonResult } from "../types/benchmark.types.js";

/**
 * Calculate average metrics from multiple results
 */
function averageResults(results: BenchmarkResult[]): BenchmarkResult["metrics"] {
  if (results.length === 0) {
    throw new Error("Cannot average empty results");
  }

  const sum = results.reduce(
    (acc, result) => ({
      duration: acc.duration + result.metrics.duration,
      pagesProcessed: acc.pagesProcessed + result.metrics.pagesProcessed,
      pagesFailed: acc.pagesFailed + result.metrics.pagesFailed,
      memoryUsed: (acc.memoryUsed || 0) + (result.metrics.memoryUsed || 0),
      errors: [...acc.errors, ...result.metrics.errors],
    }),
    {
      duration: 0,
      pagesProcessed: 0,
      pagesFailed: 0,
      memoryUsed: 0,
      errors: [] as string[],
    },
  );

  return {
    startTime: results[0].metrics.startTime,
    endTime: results[results.length - 1].metrics.endTime,
    duration: Math.round(sum.duration / results.length),
    pagesProcessed: Math.round(sum.pagesProcessed / results.length),
    pagesFailed: Math.round(sum.pagesFailed / results.length),
    memoryUsed: Math.round((sum.memoryUsed / results.length) * 100) / 100,
    errors: sum.errors,
  };
}

/**
 * Generate comparison between Playwright and Cheerio results
 */
function generateComparison(
  playwrightResults: BenchmarkResult[],
  cheerioResults: BenchmarkResult[],
): ComparisonResult {
  const playwrightAvg = averageResults(playwrightResults);
  const cheerioAvg = averageResults(cheerioResults);

  const playwrightResult: BenchmarkResult = {
    ...playwrightResults[0],
    metrics: playwrightAvg,
  };

  const cheerioResult: BenchmarkResult = {
    ...cheerioResults[0],
    metrics: cheerioAvg,
  };

  const speedup = playwrightAvg.duration / cheerioAvg.duration;
  const memoryDifference = (cheerioAvg.memoryUsed || 0) - (playwrightAvg.memoryUsed || 0);
  const pagesDifference = cheerioAvg.pagesProcessed - playwrightAvg.pagesProcessed;

  return {
    playwright: playwrightResult,
    cheerio: cheerioResult,
    speedup,
    memoryDifference,
    pagesDifference,
  };
}

/**
 * Generate benchmark report
 */
export function generateReport(
  results: BenchmarkResult[],
  config: BenchmarkConfig,
): BenchmarkReport {
  const playwrightResults = results.filter((r) => r.crawlerType === "playwright");
  const cheerioResults = results.filter((r) => r.crawlerType === "cheerio");

  let comparison: ComparisonResult | undefined;

  if (playwrightResults.length > 0 && cheerioResults.length > 0) {
    comparison = generateComparison(playwrightResults, cheerioResults);
  }

  return {
    timestamp: new Date().toISOString(),
    config,
    results,
    comparison,
  };
}

