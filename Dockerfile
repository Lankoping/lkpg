# Use official Node.js LTS image
FROM node:22-slim AS base
WORKDIR /app

# Install dependencies in a separate stage for caching
FROM base AS install
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

# Build the application
FROM base AS build
COPY --from=install /app/node_modules ./node_modules
COPY . .
ENV FOR_SITES=true
# Remove any pre-existing generated route tree — tanstackStart() plugin
# will auto-generate it synchronously during vite build
RUN rm -f src/routeTree.gen.ts && npm run build:docker

# Production image
FROM base AS release
WORKDIR /app
COPY --from=build /app/.output ./.output

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["node", ".output/server/index.mjs"]
