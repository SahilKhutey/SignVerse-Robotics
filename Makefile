# Sign-Verse Robotics OS Automation

.PHONY: up down logs build front

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

build:
	docker-compose build

front:
	cd apps/dashboard-web && pnpm install && pnpm run dev
