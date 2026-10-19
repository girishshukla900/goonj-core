FROM node:20-alpine
WORKDIR /app
COPY db ./db
COPY backend ./backend
RUN cd db && npm install --omit=dev --no-audit --no-fund
RUN cd backend && npm install --omit=dev --no-audit --no-fund
WORKDIR /app/backend
EXPOSE 4000
CMD ["node", "src/index.js"]
