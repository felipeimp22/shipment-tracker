.PHONY: build up down all db-only dev clean

build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down --remove-orphans

db-only:
	docker-compose up -d mongo

dev:
	npm run dev

local-with-db: db-only
	npm run dev

all: down build up

clean: down
	docker volume rm shipment-tracker_mongo_data || true

logs:
	docker-compose logs -f

logs-app:
	docker-compose logs -f app

logs-db:
	docker-compose logs -f mongo