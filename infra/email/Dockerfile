FROM node:24-alpine
WORKDIR /opt/picom
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY services/email-worker ./services/email-worker
USER node
EXPOSE 8787
CMD ["node", "services/email-worker/index.mjs"]
