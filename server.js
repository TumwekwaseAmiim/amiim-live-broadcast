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
const viewerDetails = {};
const roomViewers = {};

io.on('connection', (socket) => {
  console.log(`🔌 New connection: ${socket.id}`);

  // Broadcaster joins
  socket.on('broadcaster-join', ({ roomId, name }) => {
    console.log(`🎥 Broadcaster '${name}' joined room: ${roomId}`);
    broadcasters[roomId] = { id: socket.id, name };
    roomViewers[roomId] = new Set();
    socket.join(roomId);

    // Notify viewers that broadcaster is ready
    io.to(roomId).emit('broadcaster-ready', { name });
  });

  // Viewer joins
  socket.on('viewer-join', ({ roomId, name }) => {
    console.log(`👀 Viewer '${name}' joining room: ${roomId}`);
    socket.join(roomId);
    viewerDetails[socket.id] = { name, roomId };
    roomViewers[roomId]?.add(socket.id);

    const broadcaster = broadcasters[roomId];
    if (broadcaster) {
      io.to(broadcaster.id).emit('viewer-join', socket.id);
      io.to(broadcaster.id).emit('viewer-count', roomViewers[roomId].size);
    } else {
      console.log(`⚠️ No broadcaster in room: ${roomId}`);
      socket.emit('broadcaster-disconnected', 'No broadcaster available.');
    }
  });

  // WebRTC signaling
  socket.on('signal-to-viewer', ({ viewerId, signal }) => {
    console.log(`📡 Signaling to viewer ${viewerId}`);
    io.to(viewerId).emit('signal-to-viewer', { signal });
  });

  socket.on('signal-from-viewer', ({ roomId, signal }) => {
    const broadcaster = broadcasters[roomId];
    if (broadcaster) {
      console.log(`📶 Signal from viewer in room ${roomId}`);
      io.to(broadcaster.id).emit('signal-from-viewer', {
        viewerId: socket.id,
        signal,
      });
    } else {
      console.log(`🚫 Signal failed: No broadcaster in room ${roomId}`);
    }
  });

  // Chat
  socket.on('chat', ({ roomId, sender, message }) => {
    console.log(`💬 Chat from ${sender}: ${message}`);
    io.to(roomId).emit('chat', {
      sender: sender || viewerDetails[socket.id]?.name || 'Anonymous',
      message,
    });
  });

  // Emoji
  socket.on('emoji', ({ roomId, emoji }) => {
    const broadcaster = broadcasters[roomId];
    if (broadcaster) {
      io.to(broadcaster.id).emit('emoji', emoji);
    }
  });

  // Raise Hand
  socket.on('raise-hand', ({ roomId, sender }) => {
    const broadcaster = broadcasters[roomId];
    if (broadcaster) {
      io.to(broadcaster.id).emit('raise-hand', sender || viewerDetails[socket.id]?.name || 'Viewer');
    }
  });

  // Handle disconnects
  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id}`);

    for (const roomId in broadcasters) {
      if (broadcasters[roomId].id === socket.id) {
        console.log(`🚨 Broadcaster left room: ${roomId}`);
        delete broadcasters[roomId];
        io.to(roomId).emit('broadcaster-disconnected', 'Broadcaster disconnected.');
      }
    }

    for (const roomId in roomViewers) {
      if (roomViewers[roomId]?.has(socket.id)) {
        roomViewers[roomId].delete(socket.id);
        const broadcaster = broadcasters[roomId];
        if (broadcaster) {
          io.to(broadcaster.id).emit('viewer-count', roomViewers[roomId].size);
        }
      }
    }

    delete viewerDetails[socket.id];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
