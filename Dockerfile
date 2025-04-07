FROM node:18-slim

# Instala dependências necessárias para o Chrome + Puppeteer
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Instala o Google Chrome (modo headless)
#RUN wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
 #   && apt-get update \
  #  && apt install -y ./google-chrome-stable_current_amd64.deb \
   # && rm google-chrome-stable_current_amd64.deb

# Cria o diretório da aplicação
WORKDIR usr/src/app

# Copia os arquivos da aplicação
COPY . .

# Instala dependências do Node.js
RUN npm install

# Define a variável de ambiente com o caminho do Chrome
#ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Roda o bot
CMD ["node", "chatbot.js"]