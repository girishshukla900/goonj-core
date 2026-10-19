FROM node:20-alpine
WORKDIR /app
COPY db ./db
COPY community ./community
RUN cd db && npm install --omit=dev --no-audit --no-fund
WORKDIR /app/community
EXPOSE 4400
CMD ["node", "src/index.js"]
