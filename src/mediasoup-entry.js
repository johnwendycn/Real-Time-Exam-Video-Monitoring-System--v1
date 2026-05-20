// Entrypoint to build a client-side bundle for the browser
const mediasoupClient = require('mediasoup-client');
window.mediasoupClient = mediasoupClient;
console.log('[System] Mediasoup Client bundle successfully loaded into window.mediasoupClient');
