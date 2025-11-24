/**
 * Cheerio-based crawler implementation using Crawlee
 * Lightweight alternative to Playwright for static content
 */

import { CheerioCrawler, Dataset } from "crawlee";
import type { ICrawler, CrawlerOptions, ExtractedData } from "../types/crawler.types.js";

const DEFAULT_OPTIONS = {
  maxPages: 10,
  maxDepth: 2,
  timeout: 30000,
  maxConcurrency: parseInt(process.env.CRAWLER_MAX_CONCURRENCY_CHEERIO || "10", 10),
};

/**
 * Cheerio crawler implementation
 */
export class CheerioCrawlerImpl implements ICrawler {
  /**
   * Execute crawl operation
   */
  async crawl(url: string, options?: CrawlerOptions): Promise<ExtractedData> {
    const startTime = Date.now();
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const processedUrls = new Set<string>();
    const processedCount = { value: 0 };

    const crawler = new CheerioCrawler({
      maxRequestsPerCrawl: opts.maxPages,
      maxConcurrency: opts.maxConcurrency,
      requestHandlerTimeoutSecs: Math.floor(opts.timeout! / 1000),
      async requestHandler({ request, $, enqueueLinks, log }) {
        const currentUrl = request.loadedUrl || request.url;

        // Check if we've reached the limit
        if (opts.maxPages && processedCount.value >= opts.maxPages) {
          log.info(`Reached max pages limit: ${processedCount.value}/${opts.maxPages}`);
          return;
        }

        // Skip if already processed
        if (processedUrls.has(currentUrl)) {
          log.debug(`Skipping already processed URL: ${currentUrl}`);
          return;
        }

        try {
          const title = $("title").text() || "";
          const htmlContent = $.html();

          await Dataset.pushData({
            url: currentUrl,
            title,
            htmlContent,
            metadata: {
              statusCode: 200,
              timestamp: new Date().toISOString(),
            },
          });

          processedUrls.add(currentUrl);
          processedCount.value++;

          log.info(`Processed page ${processedCount.value}: ${currentUrl} - ${title}`);

          // Enqueue links if we haven't reached the limit
          if (!opts.maxPages || processedCount.value < opts.maxPages) {
            await enqueueLinks({
              strategy: "same-domain",
            });
          }
        } catch (error) {
          log.error(`Error processing ${currentUrl}: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
    });

    try {
      await crawler.run([url]);
    } finally {
      await crawler.stop();
      await crawler.teardown();
    }

    const dataset = await Dataset.getData();
    const items = (dataset?.items || []) as Array<{
      url: string;
      title: string;
      htmlContent: string;
      metadata: Record<string, unknown>;
    }>;

    return {
      items: items.map((item) => ({
        url: item.url,
        title: item.title,
        htmlContent: item.htmlContent,
        metadata: {
          statusCode: (item.metadata.statusCode as number) || 200,
          timestamp: (item.metadata.timestamp as string) || new Date().toISOString(),
          ...item.metadata,
        },
      })),
      metadata: {
        originalUrl: url,
        totalPages: items.length,
        completedAt: new Date().toISOString(),
        executionTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Execute scrap operation for multiple URLs
   */
  async scrap(urls: string[], options?: CrawlerOptions): Promise<ExtractedData> {
    const startTime = Date.now();
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const crawler = new CheerioCrawler({
      maxConcurrency: opts.maxConcurrency,
      requestHandlerTimeoutSecs: Math.floor(opts.timeout! / 1000),
      async requestHandler({ request, $, log }) {
        const currentUrl = request.loadedUrl || request.url;

        try {
          const title = $("title").text() || "";
          const htmlContent = $.html();

          await Dataset.pushData({
            url: currentUrl,
            title,
            htmlContent,
            metadata: {
              statusCode: 200,
              timestamp: new Date().toISOString(),
            },
          });

          log.info(`Scraped page: ${currentUrl} - ${title}`);
        } catch (error) {
          log.error(`Error scraping ${currentUrl}: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
    });

    try {
      await crawler.run(urls.map((url) => ({ url })));
    } finally {
      await crawler.stop();
      await crawler.teardown();
    }

    const dataset = await Dataset.getData();
    const items = (dataset?.items || []) as Array<{
      url: string;
      title: string;
      htmlContent: string;
      metadata: Record<string, unknown>;
    }>;

    return {
      items: items.map((item) => ({
        url: item.url,
        title: item.title,
        htmlContent: item.htmlContent,
        metadata: {
          statusCode: (item.metadata.statusCode as number) || 200,
          timestamp: (item.metadata.timestamp as string) || new Date().toISOString(),
          ...item.metadata,
        },
      })),
      metadata: {
        originalUrl: urls[0] || "",
        totalPages: items.length,
        completedAt: new Date().toISOString(),
        executionTime: Date.now() - startTime,
      },
    };
  }
}

