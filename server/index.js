const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { pool, initDB } = require('./db');
const { seedDatabase } = require('./seed');
const initCollab = require('./collab');
const routes = require('./routes');

const app = express();
const server = http.createServer(app);

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  process.env.CLIENT_URL,
  process.env.RAILWAY_STATIC_URL,
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.some(allowed => origin?.includes(allowed))) {
      callback(null, true);
    } else {
      // In production, allow Railway domains
      if (origin && (origin.includes('.railway.app') || origin.includes('.up.railway.app'))) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Initialize Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.some(allowed => origin?.includes(allowed))) {
        callback(null, true);
      } else if (origin && (origin.includes('.railway.app') || origin.includes('.up.railway.app'))) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }
});

// Initialize collaboration module
initCollab(io, pool);

// Serve static files from React app build folder
app.use(express.static(path.join(__dirname, '../client/build')));

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
app.use('/api/', apiLimiter);
app.use('/api/login', loginLimiter);

// Mount API routes
app.use('/api', routes);

// Handle React routing - return all requests to React app
// This must be after all API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

// Initialize database and start server
const PORT = process.env.PORT || 3001;

initDB()
  .then(async () => {
    // Automatically seed database if needed
    await seedDatabase();

    server.listen(PORT, () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`📝 Wiki available at http://localhost:${PORT}`);
      console.log(`🔌 WebSocket collaboration enabled`);
      console.log(`👤 Login with admin/admin\n`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
