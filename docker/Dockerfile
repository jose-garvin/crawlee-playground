# Dockerfile for Crawlee Benchmarking Project
FROM node:20-slim

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    && rm -rf /var/lib/apt/lists/*

# Verify Chromium installation and create symlink if needed
RUN if [ ! -f /usr/bin/chromium ]; then \
      echo "Chromium not found at /usr/bin/chromium, checking alternatives..."; \
      if [ -f /usr/bin/chromium-browser ]; then \
        ln -sf /usr/bin/chromium-browser /usr/bin/chromium; \
        echo "Created symlink from chromium-browser to chromium"; \
      else \
        echo "ERROR: No Chromium executable found!"; \
        exit 1; \
      fi; \
    else \
      echo "Chromium found at /usr/bin/chromium"; \
    fi && \
    /usr/bin/chromium --version

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Set NODE_ENV to development to ensure devDependencies (like tsx) are installed
ENV NODE_ENV=development

# Install all dependencies (including dev dependencies for tsx)
RUN npm install

# Install Playwright browsers
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

# Copy source code
COPY . .

# Create results directory
RUN mkdir -p results

# Default command (keeps container running for exec commands)
# This is overridden by docker-compose.yml when needed
CMD ["tail", "-f", "/dev/null"]

