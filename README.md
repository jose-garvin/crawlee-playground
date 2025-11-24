# Crawlee Benchmarking Project

A benchmarking project to compare execution times between **Crawlee + Playwright** and **Crawlee + Cheerio** for web crawling operations.

## Overview

This project provides a standardized way to measure and compare the performance of two different crawling approaches:

- **Playwright**: Full browser automation, handles JavaScript-rendered content
- **Cheerio**: Lightweight HTML parsing, faster but limited to static content

## Project Structure

```
crawlee-playgrounds/
├── src/
│   ├── playwright/          # Playwright crawler implementation
│   ├── cheerio/             # Cheerio crawler implementation
│   ├── benchmark/           # Benchmark runner and reporter
│   └── types/               # TypeScript type definitions
├── tests/
│   └── scenarios/          # Predefined test scenarios
├── results/                 # Benchmark results (generated)
├── docker/                  # Docker configuration
└── Makefile                 # Convenience commands
```

## Prerequisites

- Node.js 20+
- npm or pnpm
- Docker (optional, for containerized execution)

## Installation

```bash
# Install dependencies
make install
# or
npm install
npx playwright install chromium

# Copy environment configuration
cp .env.example .env
# Edit .env with your preferred settings
```

## Configuration

The project uses environment variables for configuration. Copy `.env.example` to `.env` and adjust values as needed:

```bash
cp .env.example .env
```

### Environment Variables

- `BENCHMARK_URL` - Default URL to crawl (default: `https://example.com`)
- `BENCHMARK_MAX_PAGES` - Maximum pages to crawl (default: `10`)
- `BENCHMARK_MAX_DEPTH` - Maximum crawl depth (default: `2`)
- `BENCHMARK_ITERATIONS` - Number of iterations (default: `1`)
- `BENCHMARK_TIMEOUT` - Timeout in milliseconds (default: `30000`)
- `BENCHMARK_CRAWLER` - Crawler type: `playwright`, `cheerio`, or `both` (default: `both`)
- `CRAWLER_MAX_CONCURRENCY_PLAYWRIGHT` - Max concurrency for Playwright (default: `5`)
- `CRAWLER_MAX_CONCURRENCY_CHEERIO` - Max concurrency for Cheerio (default: `10`)
- `PLAYWRIGHT_HEADLESS` - Run Playwright in headless mode (default: `true`)
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` - Custom Chromium path (optional)
- `RESULTS_DIR` - Directory for benchmark results (default: `results`)

## Usage

### Running Benchmarks

```bash
# Run both Playwright and Cheerio benchmarks (uses .env defaults)
make benchmark

# Run with a specific scenario
make benchmark ARGS="--scenario simple-static"

# Run with custom options (overrides .env values)
make benchmark ARGS="--url https://example.com --max-pages 20 --iterations 3"

# List all available scenarios
make benchmark ARGS="--list-scenarios"

# Run only Playwright with a scenario
make benchmark-playwright ARGS="--scenario medium-site"

# Run only Cheerio with a scenario
make benchmark-cheerio ARGS="--scenario documentation"
```

### Command Line Options

All options can be passed using the `ARGS` variable with `make benchmark`:

```bash
make benchmark ARGS="[options]"
```

Options:
  -u, --url <url>              URL to crawl (default: from .env or https://example.com)
  -p, --max-pages <number>     Maximum pages to crawl (default: from .env or 10)
  -d, --max-depth <number>      Maximum crawl depth (default: from .env or 2)
  -i, --iterations <number>     Number of iterations (default: from .env or 1)
  -t, --timeout <number>       Timeout in milliseconds (default: from .env or 30000)
  -c, --crawler <type>         Crawler type: playwright, cheerio, or both (default: from .env or both)
  -s, --scenario <name>        Use predefined scenario (simple-static, medium-site, documentation)
  --list-scenarios             List all available scenarios and exit
```

### Using Docker

```bash
# Build Docker image
make docker-build

# Run benchmark in Docker
make docker-benchmark

# Clean Docker resources
make docker-clean
```

### Comparing Results

```bash
# Compare latest benchmark results
make compare

# View results directory
ls -lh results/
```

## Benchmark Results

Results are saved in the `results/` directory:

- `benchmark-<timestamp>.json` - Detailed JSON report
- `benchmark-<timestamp>.txt` - Human-readable text report

### Report Format

The benchmark report includes:

- **Configuration**: URL, max pages, max depth, iterations
- **Metrics per crawler**:
  - Execution time (duration)
  - Pages processed
  - Memory usage
  - Errors (if any)
- **Comparison** (when both crawlers are tested):
  - Speedup factor
  - Memory difference
  - Pages difference

## Example Output

```
============================================================
Crawlee Benchmark: Playwright vs Cheerio
============================================================
URL: https://example.com
Max Pages: 10
Max Depth: 2
Iterations: 1
Crawler: both
============================================================

[PLAYWRIGHT] Starting iteration 1/1
[PLAYWRIGHT] Completed in 3456ms
[PLAYWRIGHT] Pages processed: 10
[PLAYWRIGHT] Memory used: 45.23MB

[CHEERIO] Starting iteration 1/1
[CHEERIO] Completed in 1234ms
[CHEERIO] Pages processed: 10
[CHEERIO] Memory used: 12.45MB

============================================================
Summary
============================================================
Playwright: 3456ms | 10 pages | 45.23MB
Cheerio:   1234ms | 10 pages | 12.45MB
Speedup: 2.80x (Cheerio faster)
============================================================
```

## Test Scenarios

Predefined test scenarios are available in `src/scenarios/basic.ts`. These scenarios provide pre-configured URLs and settings for common benchmarking use cases.

### Available Scenarios

- `simple-static`: Simple static website with minimal JavaScript (example.com)
- `medium-site`: Medium complexity site with multiple pages (httpbin.org)
- `documentation`: Documentation site with structured content (crawlee.dev)

### Using Scenarios

```bash
# List all available scenarios
make benchmark ARGS="--list-scenarios"

# Run benchmark with a specific scenario
make benchmark ARGS="--scenario simple-static"

# Run benchmark with a scenario and override iterations
make benchmark ARGS="--scenario medium-site --iterations 3"

# Run benchmark with a scenario and custom URL override
make benchmark ARGS="--scenario documentation --max-pages 15"
```

Scenarios automatically set the URL, max pages, and max depth. You can still override individual parameters if needed.

## Development

### Project Setup

1. Clone the repository
2. Install dependencies: `make install`
3. Run benchmarks: `make benchmark`

### Adding New Scenarios

Edit `src/scenarios/basic.ts` to add new test scenarios:

```typescript
export const SCENARIOS: TestScenario[] = [
  // ... existing scenarios
  {
    name: "my-scenario",
    url: "https://example.com",
    maxPages: 15,
    maxDepth: 3,
    description: "My custom scenario",
  },
];
```

### Customizing Crawlers

- Playwright crawler: `src/playwright/crawler.ts`
- Cheerio crawler: `src/cheerio/crawler.ts`

Both implement the `ICrawler` interface for consistency.

## Performance Considerations

### When to Use Playwright

- Sites with heavy JavaScript rendering
- Dynamic content that requires browser execution
- Sites that require user interaction simulation
- Complex SPAs (Single Page Applications)

### When to Use Cheerio

- Static HTML websites
- Server-side rendered content
- Fast crawling of large sites
- Resource-constrained environments

## Troubleshooting

### Playwright Browser Issues

If you encounter browser launch errors:

```bash
# Install Playwright browsers
npx playwright install chromium

# Or set environment variable
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
```

### Memory Issues

For large-scale benchmarks, consider:

- Reducing `max-pages`
- Reducing `max-concurrency`
- Running benchmarks in Docker with resource limits

### Timeout Issues

Increase timeout for slow sites:

```bash
npm run benchmark -- --timeout 60000
```

## License

MIT

## Contributing

Contributions are welcome! Please ensure all code, comments, and documentation are in English.

