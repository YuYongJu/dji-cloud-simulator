FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY simulator.mjs example-config.json ./

USER node
STOPSIGNAL SIGINT
ENTRYPOINT ["node", "simulator.mjs"]
