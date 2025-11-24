/**
 * Benchmark runner for comparing Playwright and Cheerio crawlers
 */

import "dotenv/config";
import { Command } from "commander";
import { PlaywrightCrawlerImpl } from "../playwright/crawler.js";
import { CheerioCrawlerImpl } from "../cheerio/crawler.js";
import type { BenchmarkConfig, BenchmarkResult, BenchmarkMetrics } from "../types/benchmark.types.js";
import { generateReport } from "./reporter.js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const program = new Command();

// Load default values from environment variables
const defaultUrl = process.env.BENCHMARK_URL || "https://example.com";
const defaultMaxPages = process.env.BENCHMARK_MAX_PAGES || "10";
const defaultMaxDepth = process.env.BENCHMARK_MAX_DEPTH || "2";
const defaultIterations = process.env.BENCHMARK_ITERATIONS || "1";
const defaultTimeout = process.env.BENCHMARK_TIMEOUT || "30000";
const defaultCrawler = process.env.BENCHMARK_CRAWLER || "both";

// Debug: Log environment variables to verify they are loaded
if (process.env.BENCHMARK_URL) {
  console.log(`[DEBUG] BENCHMARK_URL from env: ${process.env.BENCHMARK_URL}`);
}

program
  .name("benchmark")
  .description("Run benchmarks comparing Playwright and Cheerio crawlers")
  .option("-u, --url <url>", "URL to crawl", defaultUrl)
  .option("-p, --max-pages <number>", "Maximum pages to crawl", defaultMaxPages)
  .option("-d, --max-depth <number>", "Maximum crawl depth", defaultMaxDepth)
  .option("-i, --iterations <number>", "Number of iterations", defaultIterations)
  .option("-t, --timeout <number>", "Timeout in milliseconds", defaultTimeout)
  .option("-c, --crawler <type>", "Crawler type: playwright, cheerio, or both", defaultCrawler)
  .parse(process.argv);

const options = program.opts();

/**
 * Get memory usage in MB
 * Returns heap used memory
 */
function getMemoryUsage(): number {
  if (typeof process.memoryUsage === "function") {
    const usage = process.memoryUsage();
    return Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100;
  }
  return 0;
}

/**
 * Get peak memory usage during execution
 * This is a simple approximation - tracks the maximum memory seen
 */
let peakMemory = 0;
function trackPeakMemory(): void {
  const current = getMemoryUsage();
  if (current > peakMemory) {
    peakMemory = current;
  }
}

/**
 * Run a single benchmark iteration
 */
async function runBenchmark(
  crawlerType: "playwright" | "cheerio",
  config: BenchmarkConfig,
  iteration: number,
): Promise<BenchmarkResult> {
  console.log(`\n[${crawlerType.toUpperCase()}] Starting iteration ${iteration + 1}/${config.iterations || 1}`);

  const crawler =
    crawlerType === "playwright" ? new PlaywrightCrawlerImpl() : new CheerioCrawlerImpl();

  const startTime = Date.now();
  const startMemory = getMemoryUsage();
  peakMemory = startMemory; // Reset peak memory for this iteration
  const errors: string[] = [];

  // Track memory periodically during execution
  const memoryInterval = setInterval(() => {
    trackPeakMemory();
  }, 100); // Check every 100ms

  try {
    const result = await crawler.crawl(config.url, {
      maxPages: config.maxPages,
      maxDepth: config.maxDepth,
      timeout: config.timeout,
    });

    clearInterval(memoryInterval);
    trackPeakMemory(); // Final check

    const endTime = Date.now();
    const endMemory = getMemoryUsage();
    const duration = endTime - startTime;

    // Use peak memory minus start memory, but ensure it's never negative
    // This represents the maximum additional memory used during execution
    const memoryDelta = Math.max(0, peakMemory - startMemory);
    // Also report final memory for reference
    const finalMemory = endMemory;

    const metrics: BenchmarkMetrics = {
      startTime,
      endTime,
      duration,
      pagesProcessed: result.items.length,
      pagesFailed: 0,
      memoryUsed: memoryDelta, // Peak memory increase during execution
      errors,
    };

    console.log(`[${crawlerType.toUpperCase()}] Completed in ${duration}ms`);
    console.log(`[${crawlerType.toUpperCase()}] Pages processed: ${result.items.length}`);
    console.log(`[${crawlerType.toUpperCase()}] Memory: peak=${peakMemory.toFixed(2)}MB, final=${finalMemory.toFixed(2)}MB, delta=${memoryDelta.toFixed(2)}MB`);

    return {
      crawlerType,
      config,
      metrics,
      results: result.items.map((item) => ({
        url: item.url,
        title: item.title,
        htmlContent: item.htmlContent,
        metadata: item.metadata,
      })),
      iteration,
    };
  } catch (error) {
    clearInterval(memoryInterval);
    trackPeakMemory(); // Final check even on error

    const endTime = Date.now();
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(errorMessage);

    console.error(`[${crawlerType.toUpperCase()}] Error: ${errorMessage}`);

    const memoryDelta = Math.max(0, peakMemory - startMemory);

    return {
      crawlerType,
      config,
      metrics: {
        startTime,
        endTime,
        duration: endTime - startTime,
        pagesProcessed: 0,
        pagesFailed: 1,
        memoryUsed: memoryDelta,
        errors,
      },
      results: [],
      iteration,
    };
  }
}

/**
 * Run all benchmarks
 */
async function runBenchmarks() {
  const config: BenchmarkConfig = {
    url: options.url,
    maxPages: parseInt(options.maxPages, 10),
    maxDepth: parseInt(options.maxDepth, 10),
    iterations: parseInt(options.iterations, 10),
    timeout: parseInt(options.timeout, 10),
  };

  console.log("=".repeat(60));
  console.log("Crawlee Benchmark: Playwright vs Cheerio");
  console.log("=".repeat(60));
  console.log(`URL: ${config.url}`);
  console.log(`Max Pages: ${config.maxPages}`);
  console.log(`Max Depth: ${config.maxDepth}`);
  console.log(`Iterations: ${config.iterations}`);
  console.log(`Crawler: ${options.crawler}`);
  console.log("=".repeat(60));

  const results: BenchmarkResult[] = [];
  const crawlersToTest: ("playwright" | "cheerio")[] =
    options.crawler === "both" ? ["playwright", "cheerio"] : [options.crawler as "playwright" | "cheerio"];

  for (const crawlerType of crawlersToTest) {
    for (let i = 0; i < config.iterations!; i++) {
      const result = await runBenchmark(crawlerType, config, i);
      results.push(result);
    }
  }

  // Generate and save report
  const report = generateReport(results, config);
  const resultsDir = join(process.cwd(), process.env.RESULTS_DIR || "results");
  mkdirSync(resultsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = join(resultsDir, `benchmark-${timestamp}.json`);
  const textReportPath = join(resultsDir, `benchmark-${timestamp}.txt`);

  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  writeFileSync(textReportPath, generateTextReport(report));

  console.log("\n" + "=".repeat(60));
  console.log("Benchmark completed!");
  console.log(`JSON report: ${reportPath}`);
  console.log(`Text report: ${textReportPath}`);
  console.log("=".repeat(60));

  // Print summary
  printSummary(report);
}

/**
 * Generate text report
 */
function generateTextReport(report: ReturnType<typeof generateReport>): string {
  let output = "=".repeat(60) + "\n";
  output += "Crawlee Benchmark Report\n";
  output += "=".repeat(60) + "\n\n";
  output += `Timestamp: ${report.timestamp}\n`;
  output += `URL: ${report.config.url}\n`;
  output += `Max Pages: ${report.config.maxPages}\n`;
  output += `Max Depth: ${report.config.maxDepth}\n`;
  output += `Iterations: ${report.config.iterations}\n\n`;

  if (report.comparison) {
    const { playwright, cheerio, speedup } = report.comparison;
    output += "=".repeat(60) + "\n";
    output += "Comparison Results\n";
    output += "=".repeat(60) + "\n\n";

    output += `Playwright:\n`;
    output += `  Duration: ${playwright.metrics.duration}ms\n`;
    output += `  Pages: ${playwright.metrics.pagesProcessed}\n`;
    output += `  Memory: ${playwright.metrics.memoryUsed}MB\n\n`;

    output += `Cheerio:\n`;
    output += `  Duration: ${cheerio.metrics.duration}ms\n`;
    output += `  Pages: ${cheerio.metrics.pagesProcessed}\n`;
    output += `  Memory: ${cheerio.metrics.memoryUsed}MB\n\n`;

    output += `Speedup: ${speedup.toFixed(2)}x ${speedup > 1 ? "(Cheerio faster)" : "(Playwright faster)"}\n`;
    output += `Time Difference: ${Math.abs(playwright.metrics.duration - cheerio.metrics.duration)}ms\n`;
  } else {
    output += "=".repeat(60) + "\n";
    output += "Results\n";
    output += "=".repeat(60) + "\n\n";

    for (const result of report.results) {
      output += `${result.crawlerType.toUpperCase()} (Iteration ${result.iteration + 1}):\n`;
      output += `  Duration: ${result.metrics.duration}ms\n`;
      output += `  Pages: ${result.metrics.pagesProcessed}\n`;
      output += `  Memory: ${result.metrics.memoryUsed}MB\n\n`;
    }
  }

  return output;
}

/**
 * Print summary to console
 */
function printSummary(report: ReturnType<typeof generateReport>) {
  if (report.comparison) {
    const { playwright, cheerio, speedup } = report.comparison;
    console.log("\n" + "=".repeat(60));
    console.log("Summary");
    console.log("=".repeat(60));
    console.log(`Playwright: ${playwright.metrics.duration}ms | ${playwright.metrics.pagesProcessed} pages | ${playwright.metrics.memoryUsed}MB`);
    console.log(`Cheerio:   ${cheerio.metrics.duration}ms | ${cheerio.metrics.pagesProcessed} pages | ${cheerio.metrics.memoryUsed}MB`);
    console.log(`Speedup: ${speedup.toFixed(2)}x ${speedup > 1 ? "(Cheerio faster)" : "(Playwright faster)"}`);
    console.log("=".repeat(60));
  }
}

// Run benchmarks
runBenchmarks().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

