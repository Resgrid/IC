# Docker Deployment Guide

This guide explains how to deploy the Resgrid IC application using Docker.

## Quick Start

### Using Docker Hub or GitHub Container Registry

```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/resgrid/unit:latest

# Or pull from Docker Hub (if configured)
docker pull <dockerhub-username>/resgrid-ic:latest

# Run the container
docker run -d \
  -p 8080:80 \
  -e IC_BASE_API_URL="https://api.example.com" \
  -e IC_APP_KEY="your-app-key" \
  --name resgrid-ic \
  ghcr.io/resgrid/unit:latest
```

### Building Locally

```bash
# Build the Docker image
docker build -t resgrid-ic:latest .

# Run the container
docker run -d \
  -p 8080:80 \
  -e IC_BASE_API_URL="https://api.example.com" \
  --name resgrid-ic \
  resgrid-ic:latest
```

## Environment Variables

All configuration is done via environment variables at runtime. The Docker image does **not** contain any hardcoded secrets or API keys.

### Required Variables

- `IC_BASE_API_URL` - Base URL for the API (e.g., `https://api.resgrid.com`)

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | `production` | Application environment |
| `IC_NAME` | `Resgrid IC` | Application name |
| `IC_SCHEME` | `ResgridIC` | URL scheme |
| `IC_VERSION` | `0.0.1` | Application version |
| `IC_API_VERSION` | `v4` | API version |
| `IC_RESGRID_API_URL` | `/api/v4` | Resgrid API URL path |
| `IC_CHANNEL_HUB_NAME` | `eventingHub` | SignalR channel hub name |
| `IC_REALTIME_GEO_HUB_NAME` | `geolocationHub` | SignalR geolocation hub name |
| `IC_LOGGING_KEY` | `""` | Logging service key |
| `IC_APP_KEY` | `""` | Application key |
| `IC_MAPBOX_PUBKEY` | `""` | Mapbox public key |
| `IC_SENTRY_DSN` | `""` | Sentry DSN for error tracking |
| `IC_COUNTLY_APP_KEY` | `""` | Countly app key for analytics |
| `IC_COUNTLY_SERVER_URL` | `""` | Countly server URL |

## Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  resgrid-ic:
    image: ghcr.io/resgrid/unit:latest
    ports:
      - "8080:80"
    environment:
      - APP_ENV=production
      - IC_NAME=Resgrid IC
      - IC_SCHEME=ResgridIC
      - IC_VERSION=7.1
      - IC_BASE_API_URL=https://api.resgrid.com
      - IC_API_VERSION=v4
      - IC_RESGRID_API_URL=/api/v4
      - IC_CHANNEL_HUB_NAME=eventingHub
      - IC_REALTIME_GEO_HUB_NAME=geolocationHub
      - IC_LOGGING_KEY=${IC_LOGGING_KEY}
      - IC_APP_KEY=${IC_APP_KEY}
      - IC_MAPBOX_PUBKEY=${IC_MAPBOX_PUBKEY}
      - IC_SENTRY_DSN=${IC_SENTRY_DSN}
      - IC_COUNTLY_APP_KEY=${IC_COUNTLY_APP_KEY}
      - IC_COUNTLY_SERVER_URL=${IC_COUNTLY_SERVER_URL}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:80/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

Then run:

```bash
docker-compose up -d
```

## Using Environment Files

Create a `.env` file (never commit this to version control):

```env
IC_BASE_API_URL=https://api.resgrid.com
IC_APP_KEY=your-secret-app-key
IC_LOGGING_KEY=your-logging-key
IC_MAPBOX_PUBKEY=your-mapbox-public-key
IC_SENTRY_DSN=your-sentry-dsn
IC_COUNTLY_APP_KEY=your-countly-app-key
IC_COUNTLY_SERVER_URL=https://countly.example.com
```

Run with the environment file:

```bash
docker run -d \
  -p 8080:80 \
  --env-file .env \
  --name resgrid-ic \
  ghcr.io/resgrid/unit:latest
```

## Kubernetes Deployment

Create a `deployment.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: resgrid-ic-config
data:
  IC_BASE_API_URL: "https://api.resgrid.com"
  IC_API_VERSION: "v4"
  IC_NAME: "Resgrid IC"

---
apiVersion: v1
kind: Secret
metadata:
  name: resgrid-ic-secrets
type: Opaque
stringData:
  IC_APP_KEY: "your-secret-app-key"
  IC_LOGGING_KEY: "your-logging-key"
  IC_MAPBOX_PUBKEY: "your-mapbox-public-key"

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: resgrid-ic
spec:
  replicas: 3
  selector:
    matchLabels:
      app: resgrid-ic
  template:
    metadata:
      labels:
        app: resgrid-ic
    spec:
      containers:
      - name: resgrid-ic
        image: ghcr.io/resgrid/unit:latest
        ports:
        - containerPort: 80
        envFrom:
        - configMapRef:
            name: resgrid-ic-config
        - secretRef:
            name: resgrid-ic-secrets
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: resgrid-ic
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 80
  selector:
    app: resgrid-ic
```

Deploy:

```bash
kubectl apply -f deployment.yaml
```

## How It Works

The Docker image uses a two-stage build:

1. **Build Stage**: Compiles the web application without any environment variables
2. **Runtime Stage**: Uses nginx to serve the application

At container startup, the `docker-entrypoint.sh` script:
1. Generates an `env-config.js` file with all environment variables
2. Injects the script tag into `index.html`
3. Starts nginx

This approach allows the same Docker image to be used across multiple environments (dev, staging, production) by simply changing environment variables.

## Security Best Practices

1. **Never commit secrets**: Keep sensitive environment variables in secure storage (e.g., Kubernetes Secrets, AWS Secrets Manager)
2. **Use read-only containers**: Run containers in read-only mode where possible
3. **Scan for vulnerabilities**: Regularly scan the Docker image for security issues
4. **Use non-root user**: The nginx base image already uses a non-root user
5. **Limit resources**: Set appropriate CPU and memory limits

## Troubleshooting

### View container logs

```bash
docker logs resgrid-ic
```

### Verify environment variables are injected

```bash
docker exec resgrid-ic cat /usr/share/nginx/html/env-config.js
```

### Access container shell

```bash
docker exec -it resgrid-ic sh
```

### Check nginx configuration

```bash
docker exec resgrid-ic cat /etc/nginx/nginx.conf
```

## Multi-Architecture Support

The CI/CD pipeline builds images for both `linux/amd64` and `linux/arm64` architectures, ensuring compatibility with:
- x86-64 servers
- ARM-based servers (AWS Graviton, Raspberry Pi, etc.)
- Apple Silicon (M1/M2) development machines

## Updating the Application

To update to a new version:

```bash
# Pull the latest image
docker pull ghcr.io/resgrid/unit:latest

# Stop and remove the old container
docker stop resgrid-ic
docker rm resgrid-ic

# Start a new container with the updated image
docker run -d \
  -p 8080:80 \
  --env-file .env \
  --name resgrid-ic \
  ghcr.io/resgrid/unit:latest
```

Or with Docker Compose:

```bash
docker-compose pull
docker-compose up -d
```
