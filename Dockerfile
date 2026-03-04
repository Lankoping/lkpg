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
# Explicitly disable TSR and Nitro build-time complexities by using simple vite build
ENV TSR_AUTOGENERATE=false
ENV FOR_SITES=true
# Run tsr generate BEFORE vite build to ensure types are ready, 
# then build everything into .output
RUN bun run tsr generate && bun vite build

# Production image
FROM base AS release
WORKDIR /app
COPY --from=build /app/.output ./.output

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["bun", ".output/server/index.mjs"]
