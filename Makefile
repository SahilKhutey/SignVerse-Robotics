.PHONY: build up down test format

# Default action
all: build up

build:
	@echo "Building SignVerse Microservices..."
	docker-compose build

up:
	@echo "Starting SignVerse OS..."
	docker-compose up -d
	@echo "API Gateway running on http://localhost:8000"
	@echo "React Dashboard running on http://localhost:5173"

down:
	@echo "Shutting down SignVerse OS..."
	docker-compose down

test:
	@echo "Running verification tests..."
	PYTHONPATH=. pytest tests/ -v

format:
	@echo "Running linter and type-checker..."
	flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
	mypy core/ --ignore-missing-imports

clean:
	@echo "Cleaning caches..."
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
