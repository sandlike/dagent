.PHONY: dev test lint format typecheck

dev:
	python -m dagent_agent

test:
	pytest tests/ -v

lint:
	ruff check dagent_agent/ tests/
	mypy dagent_agent/

format:
	ruff format dagent_agent/ tests/

typecheck:
	mypy dagent_agent/ --strict
