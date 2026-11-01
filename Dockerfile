# Stage 1: Build the Vite React application
FROM node:20-alpine AS builder

WORKDIR /app

# Build arguments for Vite environment variables
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE
ARG VITE_BACKEND_URL

ENV VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN \
    VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID \
    VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE \
    VITE_BACKEND_URL=$VITE_BACKEND_URL

# Install dependencies using frozen lockfile
COPY package.json package-lock.json ./
RUN npm ci

# Copy source files and build production bundle
COPY . .
RUN npm run build

# Stage 2: Serve static files with lightweight NGINX
FROM nginx:1.27-alpine AS runner

# Remove default nginx welcome site
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy custom NGINX configuration for SPA routing and caching
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled SPA static files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
