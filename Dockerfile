FROM node:18-alpine

WORKDIR /app

# Install bash for better shell support
RUN apk add --no-cache bash

# Copy package files with correct ownership
COPY --chown=node:node package*.json ./

# Create node_modules directory with correct permissions
RUN mkdir -p node_modules && chown -R node:node /app

# Switch to node user
USER node

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY --chown=node:node . .

EXPOSE 3000

# Keep container running for development
CMD ["tail", "-f", "/dev/null"]