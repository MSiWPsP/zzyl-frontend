FROM node:18.20.2-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build:prod

FROM nginx:alpine
ENV BACKEND_URL=http://host.docker.internal:8080
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/ /usr/share/nginx/html/
EXPOSE 80
