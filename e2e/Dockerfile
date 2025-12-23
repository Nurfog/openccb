FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /e2e

COPY package*.json ./
RUN npm install

COPY . .

# Default command, can be overridden
CMD ["npx", "playwright", "test"]
