const assert = require('assert');
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

if (process.env.DRACHTIO_HOST) {
  srf.connect({
    host: process.env.DRACHTIO_HOST || '127.0.0.1',
    port: process.env.DRACHTIO_PORT || 9022,
    secret: process.env.DRACHTIO_SECRET || 'cymru'
  });
  srf.on('connect', async(err, hp) => {
    if (err) return logger.error({err}, 'Error connecting to drachtio');
    logger.info(`connected to drachtio listening on ${hp}`);

    if (process.env.K8S) {
      assert(process.env.JAMBONES_MYSQL_HOST);
      assert(process.env.JAMBONES_MYSQL_USER);
      assert(process.env.JAMBONES_MYSQL_PASSWORD);
      assert(process.env.JAMBONES_MYSQL_DATABASE);
      const { addSbcAddress } = require('@jambonz/db-helpers')({
        host: process.env.JAMBONES_MYSQL_HOST,
        user: process.env.JAMBONES_MYSQL_USER,
        password: process.env.JAMBONES_MYSQL_PASSWORD,
        database: process.env.JAMBONES_MYSQL_DATABASE,
        connectionLimit: process.env.JAMBONES_MYSQL_CONNECTION_LIMIT || 10
      }, logger);
      const hostports = hp.split(',');
      for (const hp of hostports) {
        const arr = /^(.*)\/(.*):(\d+)$/.exec(hp);
        if (arr && 'udp' === arr[1]) {
          logger.info(`adding sbc public address to database: ${arr[2]}`);
          addSbcAddress(arr[2]);
        }
      }
    }
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
