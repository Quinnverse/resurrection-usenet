# Resurrection public-demo image. Single instance; saves live on the /data volume.
# Build: docker build -t resurrection:latest .
# The image has no external model API dependency and no build step.
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    RESURRECTION_DATA_DIR=/data \
    TRUST_PROXY=1 \
    RESURRECTION_RATE_CREATE_PER_HOUR=20 \
    RESURRECTION_RATE_WRITE_PER_MINUTE=120 \
    RESURRECTION_MAX_SESSIONS=2000 \
    RESURRECTION_MAX_STORAGE_MB=512

COPY package.json ./
COPY combined-server ./combined-server
COPY frontend ./frontend
COPY LICENSE ./LICENSE

# Owned by the unprivileged node user. The application never runs as root.
RUN mkdir -p /data && chown -R node:node /data /app
USER node

EXPOSE 3000
VOLUME ["/data"]

# Node-based check: no extra tools needed in the image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "combined-server/server.js"]
