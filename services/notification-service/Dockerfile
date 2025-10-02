FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package files first for caching
COPY package*.json ./
RUN npm cache clean --force
# Install all dependencies including devDependencies
RUN npm install



# Copy the rest of the app including Prisma schema
COPY . .


# Build TypeScript
RUN npm run build

# Expose service port (literal or ARG)
EXPOSE ${PORT}

# Start the service
CMD ["npm", "run", "start:prod"]
