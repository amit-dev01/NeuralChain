.PHONY: up down build restart logs shell-backend shell-frontend migrate test seed

up:
	docker-compose up -d

down:
	docker-compose down

build:
	docker-compose build

restart:
	docker-compose down && docker-compose up -d

logs:
	docker-compose logs -f

shell-backend:
	docker exec -it neuralchain_backend bash

shell-frontend:
	docker exec -it neuralchain_frontend sh

migrate:
	@echo "Running Alembic migrations..."
	docker-compose exec backend alembic upgrade head
	@echo "Migrations applied."

test:
	docker exec neuralchain_backend pytest tests/ -v

seed:
	@echo "Seeding synthetic data..."
	docker-compose exec backend python -m synthetic_data_gen.generate \
		--n 10000 --output /app/data/raw/
	@echo "Done. File at data/raw/synthetic_transactions.csv"
