# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S discord-bot -u 1001

# Change ownership of the app directory
RUN chown -R discord-bot:nodejs /app
USER discord-bot

# Expose port (if needed for health checks)
EXPOSE 3000

# Start the bot
CMD ["npm", "start"]
