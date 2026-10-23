
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY server/package*.json ./server/
RUN npm install --prefix server

COPY client/package*.json ./client/
RUN npm install --prefix client --include=dev

COPY . .

RUN npm run build

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# `npm start` (root) runs `npm run seed` first, then boots the API.
# The repo carries no database — server/data/ is gitignored — so a fresh
# container always starts empty. Seed is idempotent: it creates the admin,
# missing settings and the sample catalogue ONLY when they are absent, and
# never touches bookings, inquiries or any existing row.
CMD ["npm", "start"]
