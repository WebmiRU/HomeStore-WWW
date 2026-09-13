FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nuxt -u 1001

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production && npm cache clean --force

COPY --from=build --chown=nuxt:nodejs /app/.nuxt ./.nuxt
COPY --from=build --chown=nuxt:nodejs /app/dist ./dist
COPY --from=build --chown=nuxt:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nuxt:nodejs /app/app ./app
COPY --from=build --chown=nuxt:nodejs /app/public ./public
COPY --from=build --chown=nuxt:nodejs /app/assets ./assets

USER nuxt

EXPOSE 3000

ENV HOST=0.0.0.0
ENV PORT=3000

CMD ["node", ".output/server/index.mjs"]
