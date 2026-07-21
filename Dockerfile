### STAGE 1: Build ###
# The web export is architecture-independent static output, so always run this stage on the
# builder's native platform ($BUILDPLATFORM). Without this, multi-arch builds run Metro under
# QEMU emulation, where Node crashes (illegal instruction) mid-bundle on arm64.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source files
COPY . .

# Build the web application with production defaults
# Runtime environment variables will be injected at startup via docker-entrypoint.sh
# APP_ENV=production ensures the build uses production defaults and no .env suffix on IDs
RUN APP_ENV=production yarn web:build

### STAGE 2: Run ###
FROM nginx:1.25-alpine

# Install sed for the entrypoint script
RUN apk add --no-cache sed

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built web app from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy entrypoint script
COPY docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port 80
EXPOSE 80

# Set default environment variables
ENV APP_ENV=production \
    IC_NAME="Resgrid IC" \
    IC_SCHEME="ResgridIC" \
    IC_BUNDLE_ID="com.resgrid.command" \
    IC_PACKAGE="com.resgrid.command" \
    IC_VERSION="0.0.1" \
    IC_BASE_API_URL="https://api.resgrid.com" \
    IC_API_VERSION="v4" \
    IC_RESGRID_API_URL="/api/v4" \
    IC_CHANNEL_HUB_NAME="eventingHub" \
    IC_REALTIME_GEO_HUB_NAME="geolocationHub" \
    IC_LOGGING_KEY="" \
    IC_APP_KEY="" \
    IC_MAPBOX_PUBKEY="" \
    IC_SENTRY_DSN="" \
    IC_COUNTLY_APP_KEY="" \
    IC_COUNTLY_SERVER_URL=""

# Use entrypoint to inject environment variables at runtime
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]