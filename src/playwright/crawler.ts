/**
 * Playwright-based crawler implementation using Crawlee
 * Adapted from the existing CrawleeService implementation
 */

import { PlaywrightCrawler, Dataset } from "crawlee";
import type { LaunchOptions } from "playwright";
import type { ICrawler, CrawlerOptions, ExtractedData } from "../types/crawler.types.js";
import { existsSync, statSync, accessSync, constants } from "fs";

const DEFAULT_OPTIONS = {
  maxPages: 10,
  maxDepth: 2,
  timeout: 30000,
  maxConcurrency: parseInt(process.env.CRAWLER_MAX_CONCURRENCY_PLAYWRIGHT || "5", 10),
};

/**
 * Playwright crawler implementation
 */
export class PlaywrightCrawlerImpl implements ICrawler {
  /**
   * Detect Chromium executable path
   */
  private detectChromiumPath(): string {
    // If explicitly set via environment variable, use that
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
      if (existsSync(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)) {
        return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
      }
    }

    // Common Chromium paths in different environments
    const possiblePaths = [
      "/usr/bin/chromium", // Alpine Linux (Docker) - This should be the symlink
      "/usr/bin/chromium-browser", // Ubuntu/Debian - This is the actual executable
      "/usr/bin/google-chrome", // Google Chrome on Linux
      "/usr/bin/google-chrome-stable", // Google Chrome stable on Linux
      "/usr/bin/chrome", // Alternative chrome path
      "/usr/bin/chromium-browser-stable", // Alternative chromium-browser path
    ];

    // Try to find an existing executable
    for (const path of possiblePaths) {
      try {
        if (existsSync(path) && statSync(path).isFile()) {
          // Check if the file is executable
          accessSync(path, constants.F_OK | constants.R_OK | constants.X_OK);
          return path;
        }
      } catch (error) {
        // Continue to next path if this one doesn't exist or isn't accessible
        continue;
      }
    }

    // Default to the path that should work in Docker
    return "/usr/bin/chromium";
  }

  private getLaunchOptions(): LaunchOptions {
    const headless = process.env.PLAYWRIGHT_HEADLESS !== "false";
    let executablePath: string | undefined;
    
    // Try to detect system Chromium, but don't fail if not found
    // Playwright will use its own browsers if executablePath is not set
    try {
      const detectedPath = this.detectChromiumPath();
      if (existsSync(detectedPath)) {
        executablePath = detectedPath;
      }
    } catch (error) {
      // If detection fails, let Playwright use its own browsers
      console.warn("Could not detect system Chromium, Playwright will use its own browsers");
    }

    const launchOptions: LaunchOptions = {
      headless,
      ...(executablePath ? { executablePath } : {}),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-features=VizDisplayCompositor",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-field-trial-config",
        "--disable-ipc-flooding-protection",
        "--single-process",
        "--disable-extensions",
        "--disable-plugins",
        "--disable-default-apps",
        "--disable-sync",
        "--disable-translate",
        "--hide-scrollbars",
        "--mute-audio",
        "--no-default-browser-check",
        "--disable-logging",
        "--disable-gpu-logging",
        "--silent",
        "--disable-background-networking",
        "--disable-client-side-phishing-detection",
        "--disable-component-extensions-with-background-pages",
        "--disable-component-update",
        "--disable-domain-reliability",
        "--disable-features=TranslateUI",
        "--disable-hang-monitor",
        "--disable-popup-blocking",
        "--disable-prompt-on-repost",
        "--disable-sync-preferences",
        "--metrics-recording-only",
        "--safebrowsing-disable-auto-update",
        "--enable-automation",
        "--password-store=basic",
        "--use-mock-keychain",
        "--disable-software-rasterizer",
        "--force-color-profile=srgb",
        "--disable-features=BlinkGenPropertyTrees",
      ],
    };

    return launchOptions;
  }

  /**
   * Execute crawl operation
   */
  async crawl(url: string, options?: CrawlerOptions): Promise<ExtractedData> {
    const startTime = Date.now();
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const processedUrls = new Set<string>();
    const processedCount = { value: 0 };

    const crawler = new PlaywrightCrawler({
      maxRequestsPerCrawl: opts.maxPages,
      maxConcurrency: opts.maxConcurrency,
      requestHandlerTimeoutSecs: Math.floor(opts.timeout! / 1000),
      launchContext: {
        launchOptions: this.getLaunchOptions(),
      },
      async requestHandler({ request, page, enqueueLinks, log }) {
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
          const title = await page.title();
          const htmlContent = await page.content();

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

    const crawler = new PlaywrightCrawler({
      maxConcurrency: opts.maxConcurrency,
      requestHandlerTimeoutSecs: Math.floor(opts.timeout! / 1000),
      launchContext: {
        launchOptions: this.getLaunchOptions(),
      },
      async requestHandler({ request, page, log }) {
        const currentUrl = request.loadedUrl || request.url;

        try {
          const title = await page.title();
          const htmlContent = await page.content();

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

