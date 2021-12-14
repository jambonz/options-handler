const debug = require('debug')('jambonz:sbc-options-handler');
const CIDRMatcher = require('cidr-matcher');
const matcher = new CIDRMatcher([process.env.JAMBONES_NETWORK_CIDR]);
const fsServers = new Map();
const rtpServers = new Map();

module.exports = ({srf, logger}) => {
  const {stats, addToSet, removeFromSet, isMemberOfSet, retrieveSet} = srf.locals;

  const setNameFs = `${(process.env.JAMBONES_CLUSTER_ID || 'default')}:active-fs`;
  const setNameRtp = `${(process.env.JAMBONES_CLUSTER_ID || 'default')}:active-rtp`;

  setInterval(async() => {
    const now = Date.now();
    const expires = process.env.EXPIRES_INTERVAL || 60000;
    for (const [key, value] of fsServers) {
      const duration = now - value;
      if (duration > expires) {
        fsServers.delete(key);
        await removeFromSet(setNameFs, key);
        const members = await retrieveSet(setNameFs);
        const countOfMembers = members.length;
        logger.info({members}, `expired member ${key} from ${setNameFs} we now have ${countOfMembers}`);
      }
    }
    for (const [key, value] of rtpServers) {
      const duration = now - value;
      if (duration > expires) {
        rtpServers.delete(key);
        await removeFromSet(setNameRtp, key);
        const members = await retrieveSet(setNameRtp);
        const countOfMembers = members.length;
        logger.info({members}, `expired member ${key} from ${setNameRtp} we now have ${countOfMembers}`);
      }
    }
  }, process.env.CHECK_EXPIRES_INTERVAL || 20000);

  return async(req, res) => {

    /* OPTIONS ping from internal FS or RTP server? */
    if (!matcher.contains(req.source_address)) {
      debug('got external OPTIONS ping');
      res.send(200);
      return;
    }

    try {
      let map, status, countOfMembers;
      const h = ['X-FS-Status', 'X-RTP-Status'].find((h) => req.has(h));
      if (h) {
        const isRtpServer = req.has('X-RTP-Status');
        const key       = isRtpServer ? req.source_address : `${req.source_address}:${req.source_port}`;
        const prefix    = isRtpServer ? 'X-RTP' : 'X-FS';
        map             = isRtpServer ? rtpServers : fsServers;
        const setName   = isRtpServer ? setNameRtp : setNameFs;
        const gaugeName = isRtpServer ? 'rtpservers' : 'featureservers';

        status = req.get(`${prefix}-Status`);

        if (status === 'open') {
          map.set(key, Date.now());
          const exists = await isMemberOfSet(setName, key);
          if (!exists) {
            await addToSet(setName, key);
            const members = await retrieveSet(setName);
            countOfMembers = members.length;
            logger.info({members}, `added new member ${key} to ${setName} we now have ${countOfMembers}`);
            debug({members}, `added new member ${key} to ${setName}`);
          }
          else {
            const members = await retrieveSet(setName);
            countOfMembers = members.length;
            debug(`checkin from existing member ${key} to ${setName}`);
          }
        }
        else {
          map.delete(key);
          await removeFromSet(setName, key);
          const members = await retrieveSet(setName);
          countOfMembers = members.length;
          logger.info({members}, `removed member ${key} from ${setName} we now have ${countOfMembers}`);
          debug({members}, `removed member ${key} from ${setName}`);
        }
        stats.gauge(gaugeName, map.size);
      }
      res.send(200, {headers: {
        'X-Members': countOfMembers
      }});
    } catch (err) {
      res.send(503);
      debug(err);
      logger.error({err}, 'Error handling OPTIONS');
    }
  };
};
