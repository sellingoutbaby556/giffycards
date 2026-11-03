# Production image for the giffycardsLLC store.
FROM node:20-alpine

WORKDIR /app

# Install only production deps first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# App source
COPY . .

# The app reads PORT from the environment; most hosts set it for you.
ENV NODE_ENV=production
EXPOSE 4242

CMD ["node", "server.js"]
