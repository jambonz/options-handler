module.exports = (logger) => {
  const initLocals = (req, res, next) => {
    req.locals = req.locals || {};
    req.locals.logger = logger.child({callId: req.get('Call-ID')});
    next();
  };

  return {
    initLocals
  };
};
