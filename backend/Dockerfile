# Node.js é o único runtime do nosso backend.
FROM node:20-slim

WORKDIR /app

# Instala Express, OracleDB e leitor de CSV.
COPY backend/package.json .
RUN npm install

# Copia nosso backend simples.
COPY backend/server.js .

# Copia a interface web.
COPY frontend ./frontend

EXPOSE 3000

CMD ["node", "server.js"]
