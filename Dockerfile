# FE build
FROM node:22-alpine AS fe
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_API_BASE_URL=/api
ARG VITE_AUTH_BYPASS=false
ARG VITE_DEMO_BANNER=false
ARG VITE_FIREBASE_API_KEY=
ARG VITE_FIREBASE_AUTH_DOMAIN=
ARG VITE_FIREBASE_PROJECT_ID=
ARG VITE_FIREBASE_APP_ID=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_AUTH_BYPASS=$VITE_AUTH_BYPASS \
    VITE_DEMO_BANNER=$VITE_DEMO_BANNER \
    VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
RUN npm run build

# API runtime
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml README.md ./
COPY agents ./agents
COPY api ./api
COPY sql ./sql
RUN pip install --no-cache-dir -e ".[dev]"
COPY --from=fe /fe/dist ./frontend/dist
ENV STATIC_FE_DIR=/app/frontend/dist
ENV PORT=8080
ENV API_AUTH_BYPASS=false
ENV PYTHONUNBUFFERED=1
EXPOSE 8080
CMD exec uvicorn api.main:app --host 0.0.0.0 --port ${PORT}
