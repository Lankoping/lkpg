# Use the official Bun image
FROM oven/bun:1.1 AS base
WORKDIR /app

# Install dependencies in a separate stage for caching
FROM base AS install
COPY package.json bun.lock ./
RUN bun install

# Build the application
FROM base AS build
COPY --from=install /app/node_modules ./node_modules
COPY . .
# Skip redundant TSR generate and Type Check during Docker build to avoid race conditions
# and speed up deployment, as Vite build handles the necessary parts.
RUN bun vite build --sourcemap

# Production image
FROM base AS release
COPY --from=build /app/.output ./.output
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server.ts ./server.ts

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port
EXPOSE 3000

# Run the production server using Bun
CMD ["bun", "run", "server.ts"]
