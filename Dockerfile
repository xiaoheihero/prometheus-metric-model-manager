FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

RUN mkdir -p /app/data

ENV DB_PATH=/app/data/prometheus_metric_manager.db

COPY package*.json ./

RUN npm install --production

COPY . .

VOLUME ["/app/data"]

EXPOSE 3000

CMD ["npm", "start"]
