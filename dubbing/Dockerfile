FROM node:20-alpine
WORKDIR /app
COPY db ./db
COPY dubbing ./dubbing
RUN cd db && npm install --omit=dev --no-audit --no-fund
WORKDIR /app/dubbing
EXPOSE 4100
CMD ["node", "src/index.js"]
