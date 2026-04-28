# Build stage
FROM node:18-slim as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8282

CMD ["npm", "run", "dev"]
