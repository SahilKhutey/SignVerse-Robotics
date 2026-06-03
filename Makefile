# ─────────────────────────────────────────────────────────────────────────────
# SignVerse Robotics — Developer Convenience Makefile
#
# Requires: Docker, docker-compose v2, pnpm
# Usage: make <target>
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: help dev up down build logs restart clean \
        test test-unit test-e2e test-watch \
        lint typecheck format \
        install deps

COMPOSE     = docker compose
DASHBOARD   = pnpm --filter "@signverse/dashboard"

# ─── Default: print available commands ───────────────────────────────────────
help:
	@echo ""
	@echo "  SignVerse Robotics — Makefile Commands"
	@echo "  ─────────────────────────────────────────"
	@echo "  make dev          Start local dev stack (hot-reload)"
	@echo "  make up           Start all services (detached)"
	@echo "  make down         Stop all services"
	@echo "  make build        Rebuild all Docker images"
	@echo "  make logs         Follow all service logs"
	@echo "  make restart      Rebuild + restart everything"
	@echo ""
	@echo "  make install      Install node dependencies"
	@echo "  make lint         Run ESLint across all packages"
	@echo "  make typecheck    Run TypeScript tsc --noEmit"
	@echo "  make format       Run Prettier formatter"
	@echo "  make test         Run all unit tests (Vitest)"
	@echo "  make test-watch   Run Vitest in watch mode"
	@echo "  make test-e2e     Run Playwright E2E tests"
	@echo ""

# ─── Docker Compose commands ──────────────────────────────────────────────────
dev:
	@echo "🚀  Starting SignVerse local development stack..."
	$(COMPOSE) up --build

up:
	@echo "🚀  Starting SignVerse services (detached)..."
	$(COMPOSE) up -d
	@echo "  Dashboard:   http://localhost:5173"
	@echo "  Gateway:     http://localhost:8000"
	@echo "  Redis:       redis://localhost:6379"

down:
	@echo "🛑  Stopping SignVerse services..."
	$(COMPOSE) down

build:
	@echo "🔨  Building Docker images..."
	$(COMPOSE) build --no-cache

logs:
	$(COMPOSE) logs -f

restart: down build up

# ─── JS/TS tooling ───────────────────────────────────────────────────────────
install:
	pnpm install

deps: install

lint:
	$(DASHBOARD) run lint

typecheck:
	$(DASHBOARD) exec tsc --noEmit

format:
	pnpm prettier --write "apps/**/*.{ts,tsx,css}" "packages/**/*.ts"

test:
	$(DASHBOARD) run test

test-watch:
	$(DASHBOARD) run test:watch

test-e2e:
	$(DASHBOARD) run test:e2e

# ─── Cleanup ─────────────────────────────────────────────────────────────────
clean:
	@echo "🧹  Cleaning build artifacts..."
	rm -rf apps/dashboard/dist apps/dashboard/.turbo
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
