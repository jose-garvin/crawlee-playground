#!/usr/bin/make
SHELL = /bin/bash

# Docker service name
SERVICE = benchmark

.PHONY: help benchmark benchmark-playwright benchmark-cheerio compare clean clean-all install build docker-build docker-benchmark docker-clean docker-shell

help: ##@miscellaneous Show this help
	@echo "Crawlee Benchmarking Project"
	@echo "Available commands:"
	@echo "  make install          - Install dependencies (in Docker)"
	@echo "  make build            - Build TypeScript project (in Docker)"
	@echo "  make benchmark        - Run both Playwright and Cheerio benchmarks (in Docker)"
	@echo "                        Example: make benchmark ARGS=\"--scenario simple-static\""
	@echo "  make benchmark-playwright - Run only Playwright benchmark (in Docker)"
	@echo "  make benchmark-cheerio - Run only Cheerio benchmark (in Docker)"
	@echo "  make compare          - Compare latest benchmark results"
	@echo "  make clean            - Clean results directory (removes JSON and TXT files)"
	@echo "  make clean-all        - Clean results directory completely (removes entire directory)"
	@echo "  make docker-build     - Build Docker image"
	@echo "  make docker-benchmark - Run benchmark in Docker"
	@echo "  make docker-shell     - Open shell in Docker container"
	@echo "  make docker-clean     - Clean Docker containers and images"

# Ensure Docker container is built and running
docker-ensure: ##@docker Ensure Docker container is built
	@if ! docker-compose ps ${SERVICE} 2>/dev/null | grep -q "Up"; then \
		echo "Building and starting Docker container..."; \
		docker-compose up -d --build ${SERVICE}; \
		echo "Waiting for container to be ready..."; \
		sleep 3; \
	fi

install: docker-ensure ##@setup Install dependencies
	docker-compose exec ${SERVICE} npm install
	docker-compose exec ${SERVICE} npx playwright install chromium

build: docker-ensure ##@setup Build TypeScript project
	docker-compose exec ${SERVICE} npm run build

benchmark: docker-ensure ##@benchmark Run both Playwright and Cheerio benchmarks (usage: make benchmark ARGS="--scenario simple-static")
	@if [ -z "$(ARGS)" ]; then \
		docker-compose exec ${SERVICE} npm run benchmark; \
	else \
		docker-compose exec ${SERVICE} sh -c "npm run benchmark -- $(ARGS)"; \
	fi

benchmark-playwright: docker-ensure ##@benchmark Run only Playwright benchmark (usage: make benchmark-playwright ARGS="--scenario simple-static")
	@if [ -z "$(ARGS)" ]; then \
		docker-compose exec ${SERVICE} npm run benchmark:playwright; \
	else \
		docker-compose exec ${SERVICE} sh -c "npm run benchmark:playwright -- $(ARGS)"; \
	fi

benchmark-cheerio: docker-ensure ##@benchmark Run only Cheerio benchmark (usage: make benchmark-cheerio ARGS="--scenario simple-static")
	@if [ -z "$(ARGS)" ]; then \
		docker-compose exec ${SERVICE} npm run benchmark:cheerio; \
	else \
		docker-compose exec ${SERVICE} sh -c "npm run benchmark:cheerio -- $(ARGS)"; \
	fi

compare: ##@benchmark Compare latest benchmark results
	@if [ -z "$$(ls -A results/*.json 2>/dev/null)" ]; then \
		echo "No benchmark results found. Run 'make benchmark' first."; \
		exit 1; \
	fi
	@latest=$$(ls -t results/*.json | head -1); \
	echo "Comparing results from: $$latest"; \
	cat $$latest | jq '.comparison // empty' || echo "No comparison data available"

clean: ##@clean Clean results directory (removes all JSON and TXT files)
	@if [ -d "results" ]; then \
		if docker-compose ps ${SERVICE} 2>/dev/null | grep -q "Up"; then \
			echo "Cleaning results from Docker container..."; \
			docker-compose exec ${SERVICE} sh -c "rm -f /app/results/*.json /app/results/*.txt 2>/dev/null || true"; \
		else \
			echo "Cleaning results from host..."; \
			chmod -R u+w results 2>/dev/null || sudo chmod -R u+w results 2>/dev/null || true; \
			rm -f results/*.json results/*.txt 2>/dev/null || sudo rm -f results/*.json results/*.txt 2>/dev/null || true; \
		fi; \
		echo "Results directory cleaned (JSON and TXT files removed)"; \
	else \
		echo "Results directory does not exist"; \
	fi

clean-all: ##@clean Clean results directory completely (removes entire directory)
	@if [ -d "results" ]; then \
		if docker-compose ps ${SERVICE} 2>/dev/null | grep -q "Up"; then \
			echo "Removing results directory from Docker container..."; \
			docker-compose exec ${SERVICE} sh -c "rm -rf /app/results && mkdir -p /app/results"; \
		else \
			echo "Removing results directory from host..."; \
			chmod -R u+w results 2>/dev/null || sudo chmod -R u+w results 2>/dev/null || true; \
			rm -rf results || sudo rm -rf results || true; \
		fi; \
		echo "Results directory completely removed"; \
	else \
		echo "Results directory does not exist"; \
	fi

docker-build: ##@docker Build Docker image
	docker-compose build

docker-benchmark: ##@docker Run benchmark in Docker (one-time execution)
	docker-compose run --rm ${SERVICE} npm run benchmark

docker-shell: docker-ensure ##@docker Open shell in Docker container
	docker-compose exec ${SERVICE} /bin/bash

docker-clean: ##@docker Clean Docker containers and images
	docker-compose down --rmi local
	@echo "Docker resources cleaned"

