import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { connectDB } from './config/database.js';
import { setSocketIO } from './services/alertService.js';

import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patients.js';
import providerRoutes from './routes/providers.js';
import organizationRoutes from './routes/organizations.js';
import encounterRoutes from './routes/encounters.js';
import observationRoutes from './routes/observations.js';
import conditionRoutes from './routes/conditions.js';
import medicationRoutes from './routes/medications.js';
import fhirRoutes from './routes/fhir.js';
import pipelineRoutes from './routes/pipelines.js';
import qualityRoutes from './routes/quality.js';
import analyticsRoutes from './routes/analytics.js';

const app = express();

// ─── Security & Middleware ───────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiter: 500 req / 15 min per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' }
}));

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/providers', providerRoutes);
app.use('/api/v1/organizations', organizationRoutes);
app.use('/api/v1/encounters', encounterRoutes);
app.use('/api/v1/observations', observationRoutes);
app.use('/api/v1/conditions', conditionRoutes);
app.use('/api/v1/medications', medicationRoutes);
app.use('/api/v1/fhir', fhirRoutes);
app.use('/api/v1/pipelines', pipelineRoutes);
app.use('/api/v1/quality', qualityRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'HealthBridge API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'HealthBridge Health Data Platform',
    version: '1.0.0',
    description: 'FHIR R4 native health data management platform',
    docs: '/api/v1/fhir/metadata',
    endpoints: {
      auth: '/api/v1/auth',
      patients: '/api/v1/patients',
      providers: '/api/v1/providers',
      encounters: '/api/v1/encounters',
      observations: '/api/v1/observations',
      conditions: '/api/v1/conditions',
      medications: '/api/v1/medications',
      fhir: '/api/v1/fhir',
      pipelines: '/api/v1/pipelines',
      quality: '/api/v1/quality',
      analytics: '/api/v1/analytics',
      organizations: '/api/v1/organizations'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Socket.io — real-time alerts & pipeline events ─────────────────────────
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.ALLOWED_ORIGINS?.split(',') || '*', credentials: true }
});

setSocketIO(io);

io.use((socket, next) => {
  // Org-room membership: client passes orgId in handshake auth
  const orgId = socket.handshake.auth?.orgId;
  if (orgId) {
    socket.orgId = orgId;
    socket.join(`org:${orgId}`);
  }
  next();
});

io.on('connection', (socket) => {
  console.log(`🔗 Client connected: ${socket.id} | org: ${socket.orgId || 'anon'}`);
  socket.on('disconnect', () => console.log(`❌ Disconnected: ${socket.id}`));
});

// ─── Boot ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`
🏥 HealthBridge Health Data Platform
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 API:        http://localhost:${PORT}
📋 FHIR R4:    http://localhost:${PORT}/api/v1/fhir/metadata
❤️  Health:    http://localhost:${PORT}/health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  });
});
