const fsServers = new Map();
const rtpServers = new Map();

module.exports = ({srf, logger}) => {
  const stats = srf.locals.stats;

  const setNameFs = `${(process.env.JAMBONES_CLUSTER_ID || 'default')}:active-fs`;
  const setNameRtp = `${(process.env.JAMBONES_CLUSTER_ID || 'default')}:active-rtp`;

  return (req, res) => {
    res.send(200);

    const {createSet} = req.srf.locals;
    let map, status, calls;
    const h = ['X-FS-Status', 'X-RTP-Status'].find((h) => req.has(h));
    if (h) {
      const isRtpServer = req.has('X-RTP-Status');
      const uri = `${req.source_address}:${req.source_port}`;
      const prefix = 'X-FS-Status' === h ? 'X-FS' : 'X-RTP';
      map = 'X-FS-Status' === h ? fsServers : rtpServers;
      status = req.get(`${prefix}-Status`);
      calls = req.has(`${prefix}-Calls`) ? parseInt(req.get(`${prefix}-Calls`)) : 0;
      const gaugeName = fsServers === map ? 'featureservers' : 'rtpservers';

      if (status === 'open') {
        const adding = !map.has(uri);
        map.set(uri, {pingTime: new Date(), calls: calls});
        if (adding) {
          stats.gauge(gaugeName, map.size);
          const ips = [...map.keys()].map((u) => {
            if (!isRtpServer) return u;
            const arr = /^(.*):\d+$/.exec(u);
            return arr[1];
          });
          logger.info(`adding ${prefix} server at ${uri}: ${[ips]}`);
          createSet(fsServers === map ? setNameFs : setNameRtp, new Set(ips));
        }
      }
      else {
        if (map.has(uri)) {
          map.delete(uri);
          stats.gauge(gaugeName, map.size);
          const ips = [...map.keys()].map((u) => {
            if (!isRtpServer) return u;
            const arr = /^(.*):\d+$/.exec(u);
            return arr[1];
          });
          logger.info(`removing feature server at ${uri}, leaving ${[ips]}`);
          createSet(fsServers === map ? setNameFs : setNameRtp, new Set(ips));
        }
      }
    }
  };
};

