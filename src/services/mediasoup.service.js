const mediasoup = require('mediasoup');
const config = require('../config/mediasoup.config');

class MediasoupService {
  constructor() {
    this.workers = [];
    this.routers = []; // One router per worker
    this.nextWorkerIndex = 0;
    
    // In-memory mappings for WebRTC state
    this.transports = new Map(); // transportId -> transport
    this.producers = new Map();  // producerId -> producer
    this.consumers = new Map();  // consumerId -> consumer
    
    // Maps to track association
    this.userRouterMap = new Map(); // userId -> router
    this.userTransportsMap = new Map(); // userId -> Set of transportIds
    this.userProducersMap = new Map();  // userId -> Set of producerIds
    this.producerUserMap = new Map();   // producerId -> userId
    this.producerRouterMap = new Map(); // producerId -> router
  }

  async initialize() {
    console.log(`[Mediasoup] Initializing ${config.numWorkers} workers...`);
    
    for (let i = 0; i < config.numWorkers; i++) {
      try {
        const worker = await mediasoup.createWorker(config.workerSettings);
        
        worker.on('died', () => {
          console.error(`[Mediasoup] Worker ${worker.pid} died, exiting...`);
          process.exit(1);
        });

        const router = await worker.createRouter(config.routerSettings);
        
        this.workers.push(worker);
        this.routers.push(router);
        
        console.log(`[Mediasoup] Worker process spawned (PID: ${worker.pid}) with associated Router.`);
      } catch (err) {
        console.error(`[Mediasoup] Failed to spawn worker/router at index ${i}:`, err.message);
      }
    }
    
    console.log('[Mediasoup] Worker pool initialized successfully.');
  }

  // Get a router using round-robin distribution to distribute load across CPU cores
  getNextRouter() {
    if (this.routers.length === 0) {
      throw new Error('Mediasoup workers are not initialized.');
    }
    const router = this.routers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.routers.length;
    return router;
  }

  // Assign a specific router to a user and cache it
  getOrCreateUserRouter(userId) {
    if (this.userRouterMap.has(userId)) {
      return this.userRouterMap.get(userId);
    }
    const router = this.getNextRouter();
    this.userRouterMap.set(userId, router);
    return router;
  }

  async createWebRtcTransport(userId, forceRouter = null) {
    const router = forceRouter || this.getOrCreateUserRouter(userId);
    
    const transportSettings = { ...config.webRtcTransportSettings };
    const transport = await router.createWebRtcTransport(transportSettings);

    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        transport.close();
      }
    });

    transport.on('close', () => {
      console.log(`[Mediasoup] Transport ${transport.id} closed for user ${userId}`);
      this.transports.delete(transport.id);
      
      const userTransports = this.userTransportsMap.get(userId);
      if (userTransports) {
        userTransports.delete(transport.id);
      }
    });

    // Save transport in memory
    this.transports.set(transport.id, transport);
    
    if (!this.userTransportsMap.has(userId)) {
      this.userTransportsMap.set(userId, new Set());
    }
    this.userTransportsMap.get(userId).add(transport.id);

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters
    };
  }

  async connectTransport(transportId, dtlsParameters) {
    const transport = this.transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport ${transportId} not found`);
    }
    await transport.connect({ dtlsParameters });
  }

  async createProducer(userId, transportId, kind, rtpParameters) {
    const transport = this.transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport ${transportId} not found`);
    }

    const producer = await transport.produce({ kind, rtpParameters });
    const router = this.userRouterMap.get(userId);

    producer.on('transportclose', () => {
      console.log(`[Mediasoup] Producer transport closed. Closing producer ${producer.id}`);
      this.closeProducer(producer.id);
    });

    // Save producer in memory
    this.producers.set(producer.id, producer);
    this.producerUserMap.set(producer.id, userId);
    this.producerRouterMap.set(producer.id, router);

    if (!this.userProducersMap.has(userId)) {
      this.userProducersMap.set(userId, new Set());
    }
    this.userProducersMap.get(userId).add(producer.id);

    return {
      id: producer.id
    };
  }

  async createConsumer(adminUserId, consumerTransportId, producerId, rtpCapabilities) {
    const transport = this.transports.get(consumerTransportId);
    if (!transport) {
      throw new Error(`Consumer transport ${consumerTransportId} not found`);
    }

    const producer = this.producers.get(producerId);
    if (!producer) {
      throw new Error(`Producer ${producerId} not found`);
    }

    // Determine routers
    const producerRouter = this.producerRouterMap.get(producerId);
    const adminRouter = this.getOrCreateUserRouter(adminUserId);

    if (!producerRouter) {
      throw new Error(`Router for producer ${producerId} not found`);
    }

    // 🚀 SCALABILITY: If the producer and consumer are on different routers/workers, pipe them!
    if (producerRouter.id !== adminRouter.id) {
      console.log(`[Mediasoup] Piping producer ${producerId} from Router ${producerRouter.id} to Admin Router ${adminRouter.id}`);
      try {
        await producerRouter.pipeToRouter({
          producerId: producerId,
          router: adminRouter
        });
      } catch (pipeErr) {
        // Mediasoup throws if the pipe already exists (e.g. admin re-logged in).
        // This is safe to ignore — the existing pipe is still active and usable.
        if (pipeErr.message && pipeErr.message.includes('already exists')) {
          console.log(`[Mediasoup] Pipe for producer ${producerId} already exists — reusing.`);
        } else {
          throw pipeErr;
        }
      }
    }

    // Can we consume it on the admin router?
    if (!adminRouter.canConsume({ producerId, rtpCapabilities })) {
      throw new Error(`Cannot consume producer ${producerId} on destination router`);
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true // Always start paused as per mediasoup best practices, client resumes it
    });

    consumer.on('transportclose', () => {
      console.log(`[Mediasoup] Consumer transport closed. Closing consumer ${consumer.id}`);
      this.consumers.delete(consumer.id);
    });

    consumer.on('producerclose', () => {
      console.log(`[Mediasoup] Producer closed. Closing consumer ${consumer.id}`);
      this.consumers.delete(consumer.id);
    });

    this.consumers.set(consumer.id, consumer);

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: consumer.type
    };
  }

  resumeConsumer(consumerId) {
    const consumer = this.consumers.get(consumerId);
    if (!consumer) {
      throw new Error(`Consumer ${consumerId} not found`);
    }
    consumer.resume();
  }

  pauseConsumer(consumerId) {
    const consumer = this.consumers.get(consumerId);
    if (!consumer) {
      throw new Error(`Consumer ${consumerId} not found`);
    }
    consumer.pause();
  }

  // Admin Direct Control: Mute/Pause user stream at SFU level
  pauseProducer(producerId) {
    const producer = this.producers.get(producerId);
    if (!producer) {
      throw new Error(`Producer ${producerId} not found`);
    }
    producer.pause();
    console.log(`[Mediasoup] Producer ${producerId} PAUSED by admin action`);
  }

  resumeProducer(producerId) {
    const producer = this.producers.get(producerId);
    if (!producer) {
      throw new Error(`Producer ${producerId} not found`);
    }
    producer.resume();
    console.log(`[Mediasoup] Producer ${producerId} RESUMED by admin action`);
  }

  closeProducer(producerId) {
    const producer = this.producers.get(producerId);
    if (!producer) return;

    producer.close();
    this.producers.delete(producerId);
    
    const userId = this.producerUserMap.get(producerId);
    if (userId) {
      const userProducers = this.userProducersMap.get(userId);
      if (userProducers) {
        userProducers.delete(producerId);
      }
    }
    this.producerUserMap.delete(producerId);
    this.producerRouterMap.delete(producerId);
  }

  // Clear everything related to a single user
  cleanupUser(userId) {
    console.log(`[Mediasoup] Cleaning up WebRTC state for user ${userId}`);

    // Close all user's producers
    const userProducers = this.userProducersMap.get(userId);
    if (userProducers) {
      for (const producerId of userProducers) {
        this.closeProducer(producerId);
      }
      this.userProducersMap.delete(userId);
    }

    // Close all user's transports
    const userTransports = this.userTransportsMap.get(userId);
    if (userTransports) {
      for (const transportId of userTransports) {
        const transport = this.transports.get(transportId);
        if (transport) {
          transport.close();
        }
      }
      this.userTransportsMap.delete(userId);
    }

    this.userRouterMap.delete(userId);
  }
}

module.exports = new MediasoupService();
