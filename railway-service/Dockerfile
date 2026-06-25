FROM node:20-slim

# ติดตั้ง LibreOffice + Python + font ภาษาไทย
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      libreoffice \
      python3 \
      fonts-thai-tlwg \
      fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY server.js .
COPY convert.py .

EXPOSE 3001
CMD ["node", "server.js"]
