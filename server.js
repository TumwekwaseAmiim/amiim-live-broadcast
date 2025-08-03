const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files (HTML, CSS, JS, MP3, etc.)
app.use(express.static(path.join(__dirname)));

// Routes (optional if using full static serve)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/viewer', (req, res) => {
  res.sendFile(path.join(__dirname, 'viewer.html'));
});

// Store broadcasters by room
const broadcasters = {};

io.on('connection', (socket) => {
  console.log(`🔌 New connection: ${socket.id}`);

  // When broadcaster joins a room
  socket.on('broadcaster-join', (roomId) => {
    console.log(`🎥 Broadcaster joined room: ${roomId}`);
    broadcasters[roomId] = socket.id;
    socket.join(roomId);
  });

  // When viewer joins a room
  socket.on('viewer-join', (roomId) => {
    console.log(`👀 Viewer requesting stream for room: ${roomId}`);
    socket.join(roomId);
    const broadcasterId = broadcasters[roomId];
    if (broadcasterId) {
      io.to(broadcasterId).emit('viewer-join', socket.id);
    } else {
      socket.emit('broadcaster-disconnected');
    }
  });

  // Signal from broadcaster to viewer
  socket.on('signal-to-viewer', ({ viewerId, signal }) => {
    io.to(viewerId).emit('signal-to-viewer', { signal });
  });

  // Signal from viewer to broadcaster
  socket.on('signal-from-viewer', ({ roomId, signal }) => {
    const broadcasterId = broadcasters[roomId];
    if (broadcasterId) {
      io.to(broadcasterId).emit('signal-from-viewer', {
        viewerId: socket.id,
        signal,
      });
    }
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    // Find and remove the disconnected broadcaster
    for (const roomId in broadcasters) {
      if (broadcasters[roomId] === socket.id) {
        delete broadcasters[roomId];
        io.to(roomId).emit('broadcaster-disconnected');
      }
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
