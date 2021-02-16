import WebSocket from "ws";
import {BHN} from "bhn";

const CLIENTS = {};
const started = + new Date();
async function startNode(config) {
  let node = new BHN({
    // network: 'testnet',
    startHeight: 670843
  })

  process.on('unhandledRejection', err => {
    throw err
  })

  process.on('SIGINT', async () => {
    if (node && node.opened) await node.close()
    process.exit()
  })

  // you can even set event listeners!
  node.on('connect', entry => {
    const createXsecondsBeforeTheStart = Math.round((started)/1000) - entry.time;
    if (createXsecondsBeforeTheStart < 0 ) {
      sendAll(JSON.stringify(entry), 'blocks');
    } else {
      console.log('createXsecondsBeforeTheStart', createXsecondsBeforeTheStart);
    }
  })

  try {
    await node.ensure()
    await node.open()
    await node.connect()
    await node.startSync()
  } catch (e) {
    console.error(e.stack)
    process.exit(1)
  }

  return node
}

await startNode();

const wss = new WebSocket.Server({
  port: 8000,
  perMessageDeflate: {
    zlibDeflateOptions: {
      // See zlib defaults.
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    // Other options settable:
    clientNoContextTakeover: true, // Defaults to negotiated value.
    serverNotimeContextTakeover: true, // Defaults to negotiated value.
    serverMaxWindowBits: 10, // Defaults to negotiated value.
    // Below options specified as default values.
    concurrencyLimit: 10, // Limits zlib concurrency for perf.
    threshold: 1024 // Size (in bytes) below which messages
    // should not be compressed.
  }
});

wss.on('connection', function connection(ws) {
  const wsId = (+ new Date()).toString() + Math.random().toString()
  ws.wsId = wsId;
  ws.channels = [];
  ws.on('message', function incoming(message) {
    let data = {};

    try {
      data = JSON.parse(message);
    } catch (e) {

    }

    if (data.subscribe === 'blocks') {
      if (ws.channels.indexOf('blocks') === -1) {
        ws.channels.push('blocks');
        console.log('subscribed', message);
      }
    }

  });

  ws.on('close', (ws) => {
    console.log("Socket closed" + ws.wsId);
    delete CLIENTS[ws.wsId];
  });

  CLIENTS[ws.wsId] = ws;

});

function sendAll(message, channel) {
  for (let wsId in CLIENTS) {
    const ws = CLIENTS[wsId];
    if (ws.channels.length && ws.channels.includes(channel)) {
      CLIENTS[wsId].send(message);
    }

  }
}
