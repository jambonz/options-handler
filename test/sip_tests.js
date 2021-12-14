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

function waitFor(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms * 1000);
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

    await sippUac('uac-add-fs-1.xml', '172.32.0.10');
    t.pass('added a feature server');

    await sippUac('uac-add-rtp-1.xml', '172.32.0.10');
    t.pass('added an RTP server');

    await sippUac('uac-add-fs-2.xml', '172.32.0.11');
    t.pass('added a second feature server');

    await sippUac('uac-add-fs-2.xml', '172.32.0.11');
    t.pass('second feature server checks in again');

    await sippUac('uac-add-rtp-2.xml', '172.32.0.11');
    t.pass('added a second RTP server');
    
    await sippUac('uac-remove-fs-1.xml', '172.32.0.10');
    t.pass('remove feature server 1');

    await sippUac('uac-remove-rtp-1.xml', '172.32.0.10');
    t.pass('remove rtp server 1');

    await sippUac('uac-remove-fs-2.xml', '172.32.0.11');
    t.pass('removed second feature server');

    await sippUac('uac-remove-rtp-2.xml', '172.32.0.11');
    t.pass('removed second rtp server');

    await sippUac('uac-external-options-ping.xml', '172.32.1.10');
    t.pass('handled external options ping');

    await sippUac('uac-add-fs-1.xml', '172.32.0.10');
    t.pass('added a feature server');

    await waitFor(16);

    await sippUac('uac-add-fs-1.xml', '172.32.0.10');
    t.pass('feature server expired due to lack of check-in');

    t.end();
  } catch (err) {
    console.log(`error received: ${err}`);
    t.end(err);
  }
});
