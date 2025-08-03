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
const viewerDetails = {}; // store viewer info per socket.id
const roomViewers = {}; // track viewers per room

io.on('connection', (socket) => {
  console.log(`🔌 New connection: ${socket.id}`);

  // Broadcaster joins
  socket.on('broadcaster-join', ({ roomId, name }) => {
    console.log(`🎥 Broadcaster '${name}' joined room: ${roomId}`);
    broadcasters[roomId] = { id: socket.id, name };
    roomViewers[roomId] = new Set();
    socket.join(roomId);
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
      socket.emit('broadcaster-disconnected');
    }
  });

  // Signaling
  socket.on('signal-to-viewer', ({ viewerId, signal }) => {
    io.to(viewerId).emit('signal-to-viewer', { signal });
  });

  socket.on('signal-from-viewer', ({ roomId, signal }) => {
    const broadcaster = broadcasters[roomId];
    if (broadcaster) {
      io.to(broadcaster.id).emit('signal-from-viewer', {
        viewerId: socket.id,
        signal,
      });
    }
  });

  // 💬 Chat support
  socket.on('chat', ({ roomId, sender, message }) => {
    io.to(roomId).emit('chat', {
      sender: sender || viewerDetails[socket.id]?.name || 'Anonymous',
      message,
    });
  });

  // 😍 Emoji support
  socket.on('emoji', ({ roomId, emoji }) => {
    const broadcaster = broadcasters[roomId];
    if (broadcaster) {
      io.to(broadcaster.id).emit('emoji', emoji);
    }
  });

  // ✋ Raise hand
  socket.on('raise-hand', (roomId) => {
    const broadcaster = broadcasters[roomId];
    const viewerName = viewerDetails[socket.id]?.name || 'Viewer';
    if (broadcaster) {
      io.to(broadcaster.id).emit('raise-hand', viewerName);
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id}`);

    for (const roomId in broadcasters) {
      if (broadcasters[roomId].id === socket.id) {
        delete broadcasters[roomId];
        io.to(roomId).emit('broadcaster-disconnected');
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
