FROM node:alpine AS build

RUN apk update && apk add python build-base gcc wget git bash
RUN mkdir -p /usr/src/bot
WORKDIR /usr/src/bot

COPY package*.json /usr/src/bot/
RUN npm install


FROM node:alpine

RUN apk update && apk upgrade && apk add ffmpeg
RUN rm -rf /var/cache/apk/*
COPY --from=build /usr/src/bot/node_modules /usr/src/bot/node_modules
COPY . /usr/src/bot

CMD ["node", "/usr/src/bot/index.js"]