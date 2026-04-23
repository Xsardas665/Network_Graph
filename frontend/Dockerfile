# Build stage
FROM node:18-slim as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM nginx:stable-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/vite.config.js /tmp/

# Custom nginx config to handle SPA routing and proxying
RUN echo 'server { \
    listen 8282; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
    location /api { \
        proxy_pass http://backend:9292; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 8282

CMD ["nginx", "-g", "daemon off;"]
