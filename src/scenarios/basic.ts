/**
 * Basic test scenarios for benchmarking
 */

export interface TestScenario {
  name: string;
  url: string;
  maxPages: number;
  maxDepth: number;
  description: string;
}

export const SCENARIOS: TestScenario[] = [
  {
    name: "simple-static",
    url: "https://example.com",
    maxPages: 5,
    maxDepth: 1,
    description: "Simple static website with minimal JavaScript",
  },
  {
    name: "medium-site",
    url: "https://httpbin.org",
    maxPages: 10,
    maxDepth: 2,
    description: "Medium complexity site with multiple pages",
  },
  {
    name: "documentation",
    url: "https://crawlee.dev",
    maxPages: 20,
    maxDepth: 2,
    description: "Documentation site with structured content",
  },
];

export function getScenario(name: string): TestScenario | undefined {
  return SCENARIOS.find((s) => s.name === name);
}

