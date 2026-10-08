FROM python:3.11-slim

# Set environment variables for production
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app:/app/backend \
    PORT=8000

WORKDIR /app

# Install system dependencies (compiler, libpq for PostgreSQL, curl for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Pre-install CPU version of PyTorch to keep image lightweight and avoid 3GB+ CUDA wheels
RUN pip install --no-cache-dir torch==2.3.0 --index-url https://download.pytorch.org/whl/cpu

# Copy requirements from backend directory
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create runtime directories for data, GeoIP, and models
RUN mkdir -p /app/data/geoip /app/data/mlruns /app/models

# Copy backend application source code directly to /app
COPY backend/ .

# Expose default port (Render will bind via $PORT)
EXPOSE 8000

# Start Uvicorn server binding to 0.0.0.0 and listening on Render's assigned $PORT
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
