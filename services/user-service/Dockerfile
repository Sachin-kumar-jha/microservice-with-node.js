FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

# Generate Prisma client
RUN npx prisma generate


# Build TypeScript
RUN npm run build

EXPOSE ${PORT}

CMD ["npm", "run", "start:prod"]
