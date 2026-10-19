FROM node:20-alpine
WORKDIR /app
COPY db ./db
COPY live ./live
RUN cd db && npm install --omit=dev --no-audit --no-fund
WORKDIR /app/live
EXPOSE 4300
CMD ["node", "src/index.js"]
