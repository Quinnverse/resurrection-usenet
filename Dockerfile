# Resurrection v1.0 demo image. Prepared for deployment; not deployed by this repository.
# Build: docker build -t resurrection .
# Run:   docker run -p 3000:3000 -v resurrection-data:/data resurrection
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    RESURRECTION_DATA_DIR=/data

COPY package.json ./
COPY combined-server ./combined-server
COPY frontend ./frontend

RUN mkdir -p /data && chown -R node:node /data
USER node

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1

CMD ["node", "combined-server/server.js"]
