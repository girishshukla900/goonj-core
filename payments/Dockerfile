FROM node:20-alpine
WORKDIR /app
COPY db ./db
COPY payments ./payments
RUN cd db && npm install --omit=dev --no-audit --no-fund
WORKDIR /app/payments
EXPOSE 4200
CMD ["node", "src/index.js"]
