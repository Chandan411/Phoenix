# Use official Node.js image
FROM node:20
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
EXPOSE 8000
CMD ["npm", "start"]
