.PHONY: help install backend frontend dev train test build clean

help:
	@echo "NAVIQ development commands"
	@echo ""
	@echo "  make install    Install backend and frontend dependencies"
	@echo "  make backend    Run the API on :8000"
	@echo "  make frontend   Run the UI on :5173"
	@echo "  make dev        Run both together"
	@echo "  make train      Retrain the fuel prediction model"
	@echo "  make test       Run the verification suite"
	@echo "  make build      Production build of the frontend"
	@echo "  make clean      Remove build artefacts and the demo database"

install:
	cd backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt \
		&& .venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
	cd frontend && npm install

backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

dev:
	@echo "Starting backend on :8000 and frontend on :5173"
	@cd backend && .venv/bin/uvicorn app.main:app --port 8000 & \
	cd frontend && npm run dev; \
	wait

train:
	cd backend && .venv/bin/python -m app.core.prediction.train --epochs 80 --voyages 800

test:
	cd backend && .venv/bin/python -m pytest tests -v

build:
	cd frontend && npm run build

clean:
	rm -rf frontend/dist frontend/node_modules/.vite
	rm -f backend/app/data/naviq.db
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
