FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data

# No npm dependencies: the server uses Node's built-in http + node:sqlite
# encounter.js + monsters.json: the encounter generator and its SRD monster data
COPY server.js encounter.js monsters.json ./
COPY app ./app

RUN mkdir -p /data
VOLUME /data
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["node", "--no-warnings", "server.js"]
