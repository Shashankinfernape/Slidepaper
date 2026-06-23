# Use official Node.js runtime as a parent image
FROM node:20-slim

# Install system dependencies (ImageMagick)
RUN apt-get update && apt-get install -y \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install application dependencies
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 5001

# Define environment variables
ENV PORT=5001
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
