const debug = require('debug')('jambonz:sbc-options-handler');
const CIDRMatcher = require('cidr-matcher');
const matcher = new CIDRMatcher([process.env.JAMBONES_NETWORK_CIDR]);
const fsServers = new Map();
const rtpServers = new Map();

module.exports = ({srf, logger}) => {
  const stats = srf.locals.stats;

  const setNameFs = `${(process.env.JAMBONES_CLUSTER_ID || 'default')}:active-fs`;
  const setNameRtp = `${(process.env.JAMBONES_CLUSTER_ID || 'default')}:active-rtp`;

  return async(req, res) => {

    /* OPTIONS ping from internal FS or RTP server? */
    if (!matcher.contains(req.source_address)) {
      debug('got external OPTIONS ping');
      res.send(200);
      return;
    }

    try {
      const {addToSet, removeFromSet, isMemberOfSet, retrieveSet} = srf.locals;
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
