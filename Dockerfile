# 1단계: 빌드 (Node.js 환경)
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 2단계: 실행 (Nginx 웹 서버 환경)
FROM nginx:stable-alpine
# Vite 빌드 결과물인 dist 폴더를 Nginx 서버 경로로 복사
COPY --from=build /app/dist /usr/share/nginx/html
# 80번 포트 개방
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]