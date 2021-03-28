const test = require('tape');
const { sippUac } = require('./sipp')('test_drachtio');
const clearModule = require('clear-module');

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

function connect(connectable) {
  return new Promise((resolve, reject) => {
    connectable.on('connect', () => {
      return resolve();
    });
  });
}

test('sip tests', async(t) => {
  clearModule.all();
  const {srf, disconnect} = require('../app');

  t.teardown(() => {
    disconnect();
  });

  try {
    await connect(srf);
    await sippUac('uac-options-expect-200.xml', '172.32.0.10');
    t.pass('options test passes');
    t.end();
  } catch (err) {
    console.log(`error received: ${err}`);
    t.end(err);
  }
});
