const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/viewer', (req, res) => {
  res.sendFile(path.join(__dirname, 'viewer.html'));
});

app.get('/status', (req, res) => {
  res.send('✅ Server is running and accepting connections.');
});

const broadcasters = {};
const roomViewers = {};

io.on('connection', (socket) => {
  console.log(`🔌 New connection: ${socket.id}`);

  socket.on('broadcaster-join', (roomId) => {
    console.log(`🎥 Broadcaster joined room: ${roomId}`);
    broadcasters[roomId] = socket.id;
    if (!roomViewers[roomId]) roomViewers[roomId] = new Set();
    socket.join(roomId);
  });

  socket.on('viewer-join', (roomId) => {
    console.log(`👀 Viewer requesting stream for room: ${roomId}`);
    socket.join(roomId);
    roomViewers[roomId]?.add(socket.id);

    const broadcasterId = broadcasters[roomId];
    if (broadcasterId) {
      io.to(broadcasterId).emit('viewer-join', socket.id);
      io.to(broadcasterId).emit('viewer-count', roomViewers[roomId].size);
    } else {
      socket.emit('broadcaster-disconnected');
    }
  });

  socket.on('signal-to-viewer', ({ viewerId, signal }) => {
    io.to(viewerId).emit('signal-to-viewer', { signal });
  });

  socket.on('signal-from-viewer', ({ roomId, signal }) => {
    const broadcasterId = broadcasters[roomId];
    if (broadcasterId) {
      io.to(broadcasterId).emit('signal-from-viewer', {
        viewerId: socket.id,
        signal,
      });
    }
  });

  // 💬 Chat
  socket.on('chat', ({ roomId, sender, message }) => {
    io.to(roomId).emit('chat', { sender, message });
  });

  // 😃 Emoji
  socket.on('emoji', ({ roomId, emoji }) => {
    const broadcasterId = broadcasters[roomId];
    if (broadcasterId) {
      io.to(broadcasterId).emit('emoji', emoji);
    }
  });

  // ✋ Raise hand
  socket.on('raise-hand', (roomId) => {
    const broadcasterId = broadcasters[roomId];
    if (broadcasterId) {
      io.to(broadcasterId).emit('raise-hand', socket.id);
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id}`);

    for (const roomId in broadcasters) {
      if (broadcasters[roomId] === socket.id) {
        delete broadcasters[roomId];
        io.to(roomId).emit('broadcaster-disconnected');
      }
    }

    for (const roomId in roomViewers) {
      if (roomViewers[roomId]?.has(socket.id)) {
        roomViewers[roomId].delete(socket.id);
        const broadcasterId = broadcasters[roomId];
        if (broadcasterId) {
          io.to(broadcasterId).emit('viewer-count', roomViewers[roomId].size);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
