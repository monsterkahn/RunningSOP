FROM node:24-bookworm-slim
WORKDIR /opt/running-sop
COPY LICENSE ./LICENSE
COPY --chown=node:node server/ ./server/
COPY --chown=node:node extension/catalog-engine.js extension/image-marks.js extension/category-engine.js ./extension/
RUN mkdir /data && chown node:node /data
USER node
ENV SOP_DATA_DIR=/data HOST=0.0.0.0 PORT=8787
VOLUME ["/data"]
EXPOSE 8787
CMD ["node", "server/cli.cjs"]
