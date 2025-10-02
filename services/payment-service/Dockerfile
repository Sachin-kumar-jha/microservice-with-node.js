FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm cache clean --force
RUN npm install 

COPY . .

RUN npm run build

EXPOSE ${PORT}

CMD ["npm", "run", "start:prod"]
