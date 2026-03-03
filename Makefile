# AppleFlow POS Backend - Makefile
# Quick commands for development and deployment

.PHONY: help install dev build start test lint db-migrate db-seed db-reset docker-up docker-down docker-logs deploy backup

# Default target
help:
	@echo "🍎 AppleFlow POS Backend - Available Commands"
	@echo ""
	@echo "Development:"
	@echo "  make install      - Install dependencies"
	@echo "  make dev          - Start development server"
	@echo "  make build        - Build for production"
	@echo "  make start        - Start production server"
	@echo "  make test         - Run tests"
	@echo "  make lint         - Run linter"
	@echo ""
	@echo "Database:"
	@echo "  make db-migrate   - Run database migrations"
	@echo "  make db-seed      - Seed database"
	@echo "  make db-reset     - Reset database (dangerous!)"
	@echo "  make db-studio    - Open Prisma Studio"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up    - Start Docker containers"
	@echo "  make docker-down  - Stop Docker containers"
	@echo "  make docker-logs  - View Docker logs"
	@echo "  make docker-build - Rebuild Docker images"
	@echo ""
	@echo "Deployment:"
	@echo "  make setup        - Run server setup script"
	@echo "  make deploy       - Deploy to production"
	@echo "  make backup       - Create database backup"

# Development
install:
	npm install

dev:
	npm run dev

build:
	npm run build

start:
	npm start

test:
	npm test

lint:
	npm run lint

# Database
db-migrate:
	npx prisma migrate dev

db-seed:
	npx prisma db seed

db-reset:
	@echo "⚠️  This will delete all data! Are you sure? [y/N] " && read ans && [ $${ans:-N} = y ]
	npx prisma migrate reset --force

db-studio:
	npx prisma studio

# Docker
docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

docker-build:
	docker-compose up -d --build

docker-prod:
	docker-compose -f docker-compose.prod.yml up -d

# Deployment
setup:
	sudo ./scripts/setup.sh

deploy:
	sudo ./scripts/deploy.sh

backup:
	docker-compose exec postgres pg_dump -U appleflow appleflow_pos | gzip > backups/manual_backup_$(shell date +%Y%m%d_%H%M%S).sql.gz

# Utilities
clean:
	rm -rf node_modules dist
	docker-compose down -v

logs:
	tail -f logs/*.log
