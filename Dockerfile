# nginx 이미지 사용
FROM nginx:alpine

# 빌드된 정적 파일을 nginx html 디렉토리로 복사
COPY dist /usr/share/nginx/html

# nginx 설정 파일 복사
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 포트 노출
EXPOSE 80

# nginx 실행
CMD ["nginx", "-g", "daemon off;"]
