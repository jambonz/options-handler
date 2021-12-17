const assert = require('assert');
assert.ok(process.env.JAMBONES_NETWORK_CIDR, 'missing JAMBONES_NETWORK_CIDR env var');
const Srf = require('drachtio-srf');
const srf = new Srf();
const opts = Object.assign({
  timestamp: () => {return `, "time": "${new Date().toISOString()}"`;}
}, {level: process.env.LOGLEVEL || 'info'});
const logger = require('pino')(opts);
const {initLocals} = require('./lib/middleware')(logger);
const {addToSet, removeFromSet, isMemberOfSet, retrieveSet} = require('@jambonz/realtimedb-helpers')({
  host: process.env.JAMBONES_REDIS_HOST || 'localhost',
  port: process.env.JAMBONES_REDIS_PORT || 6379
}, logger);
const StatsCollector = require('@jambonz/stats-collector');
const stats = new StatsCollector(logger);

srf.locals = {...srf.locals, stats, addToSet, removeFromSet, isMemberOfSet, retrieveSet};

if (process.env.DRACHTIO_HOST && !process.env.K8S) {
  srf.connect({
    host: process.env.DRACHTIO_HOST || '127.0.0.1',
    port: process.env.DRACHTIO_PORT || 9022,
    secret: process.env.DRACHTIO_SECRET || 'cymru'
  });
  srf.on('connect', async(err, hp) => {
    if (err) return logger.error({err}, 'Error connecting to drachtio');
    logger.info(`connected to drachtio listening on ${hp}`);
  });
}
else {
  logger.info(`listening in outbound mode on port ${process.env.DRACHTIO_PORT}`);
  srf.listen({port: process.env.DRACHTIO_PORT, secret: process.env.DRACHTIO_SECRET});
}

srf.options([initLocals], require('./lib/options')({srf, logger}));

if ('test' === process.env.NODE_ENV) {
  const disconnect = () => {
    return new Promise ((resolve) => {
      srf.disconnect();
      resolve();
    });
  };

  module.exports = {srf, logger, disconnect};
}
