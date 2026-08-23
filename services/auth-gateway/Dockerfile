FROM node:22-alpine
WORKDIR /app
COPY package.json route-contract.mjs index.mjs ./
ENV AUTH_GATEWAY_PORT=4180
ENV AUTH_GATEWAY_BIND=0.0.0.0
ENV NODE_ENV=production
EXPOSE 4180
USER node
CMD ["node", "index.mjs"]
