# Obraz WatchSync: jeden proces Node.js (HTTP + WebSocket na jednym porcie)
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# najpierw same zależności, żeby warstwa z node_modules była cache'owana
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# kod aplikacji bez zmian
COPY server ./server
COPY client ./client

USER node

EXPOSE 3000

# sprawdzenie, czy serwer odpowiada na HTTP (strona startowa z client/)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server/server.js"]
