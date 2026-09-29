.PHONY: up down build restart logs shell-backend shell-frontend

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
	docker exec neuralchain_backend alembic upgrade head

test:
	docker exec neuralchain_backend pytest tests/ -v
