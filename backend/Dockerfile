FROM python:3.13-slim

WORKDIR /app

# Install dependencies first so the layer caches across code changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY app ./app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
    CMD python -c "import os,urllib.request; urllib.request.urlopen(f'http://localhost:{os.environ.get(\"PORT\",8000)}/health')"

# Railway (and most PaaS hosts) inject $PORT at runtime; default to 8000 for
# local `docker run` where it is unset.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
