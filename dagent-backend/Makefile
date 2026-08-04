.PHONY: dev test lint format migrate revision

dev:
	uvicorn dagent.app:create_app --factory --reload --host 0.0.0.0 --port 8000

test:
	pytest tests/ -v

lint:
	ruff check dagent/ tests/
	mypy dagent/

format:
	ruff format dagent/ tests/

migrate:
	alembic upgrade head

revision:
	alembic revision --autogenerate -m "$(msg)"
