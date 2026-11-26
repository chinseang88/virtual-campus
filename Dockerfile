FROM python:3.11-slim

WORKDIR /app
COPY index.html server.py .env.example ./
COPY js ./js

ENV PORT=8081
EXPOSE 8081

CMD ["python", "server.py"]
