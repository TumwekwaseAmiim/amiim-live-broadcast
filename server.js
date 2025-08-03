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

// Trackers
const broadcasters = {};
const viewerDetails = {};
const roomViewers = {};

io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  // Broadcaster joins
  socket.on('broadcaster-join', ({ roomId, name }) => {
    broadcasters[roomId] = { id: socket.id, name };
    socket.join(roomId);
    if (!roomViewers[roomId]) roomViewers[roomId] = new Set();
    io.to(roomId).emit('broadcaster-ready', { name });
    socket.emit('broadcaster-confirmed', { success: true });
  });

  // Viewer joins
  socket.on('viewer-join', ({ roomId, name }) => {
    socket.join(roomId);
    viewerDetails[socket.id] = { name, roomId };
    if (!roomViewers[roomId]) roomViewers[roomId] = new Set();
    roomViewers[roomId].add(socket.id);

    const broadcaster = broadcasters[roomId];
    if (broadcaster) {
      io.to(broadcaster.id).emit('viewer-join', { viewerId: socket.id, name });
      io.to(roomId).emit('viewer-count', roomViewers[roomId].size);
    } else {
      socket.emit('broadcaster-disconnected', 'No broadcaster available.');
    }
  });

  // WebRTC Signaling
  socket.on('signal-to-viewer', ({ viewerId, signal }) => {
    io.to(viewerId).emit('signal-from-broadcaster', { signal });
  });

  socket.on('signal-to-broadcaster', ({ roomId, signal, name }) => {
    const broadcaster = broadcasters[roomId];
    if (broadcaster) {
      io.to(broadcaster.id).emit('signal-to-broadcaster', {
        viewerId: socket.id,
        signal,
        name,
      });
    }
  });

  // Chat
  socket.on('chat', ({ roomId, sender, message }) => {
    const name =
      sender ||
      viewerDetails[socket.id]?.name ||
      broadcasters[roomId]?.name ||
      'Anonymous';
    console.log(`💬 Chat from ${name}: ${message}`);
    io.to(roomId).emit('chat', { sender: name, message });
  });

  // Emoji
  socket.on('emoji', ({ roomId, emoji }) => {
    io.to(roomId).emit('emoji', emoji);
  });

  // Raise hand
  socket.on('raise-hand', ({ roomId, sender }) => {
    const broadcaster = broadcasters[roomId];
    if (broadcaster) {
      io.to(broadcaster.id).emit('raise-hand', sender);
    }
  });

  // Allow Mic
  socket.on('allow-mic', ({ roomId, viewerName }) => {
    const viewerId = getViewerSocketId(roomId, viewerName);
    if (viewerId) {
      io.to(viewerId).emit('allow-mic', { viewerName });
    }
  });

  // Allow Recording
  socket.on('allow-recording', ({ roomId, viewerName }) => {
    const viewerId = getViewerSocketId(roomId, viewerName);
    if (viewerId) {
      io.to(viewerId).emit('allow-recording', { viewerName });
    }
  });

  // Disconnection
  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id}`);

    for (const roomId in broadcasters) {
      if (broadcasters[roomId].id === socket.id) {
        delete broadcasters[roomId];
        if (roomViewers[roomId]) {
          roomViewers[roomId].forEach((viewerId) => {
            io.to(viewerId).emit(
              'broadcaster-disconnected',
              'Broadcaster disconnected.'
            );
          });
        }
      }
    }

    for (const roomId in roomViewers) {
      if (roomViewers[roomId]?.has(socket.id)) {
        roomViewers[roomId].delete(socket.id);
        const broadcaster = broadcasters[roomId];
        if (broadcaster) {
          io.to(broadcaster.id).emit(
            'viewer-count',
            roomViewers[roomId].size
          );
        }
      }
    }

    delete viewerDetails[socket.id];
  });

  // Utility function
  function getViewerSocketId(roomId, name) {
    return (
      Object.entries(viewerDetails).find(
        ([, d]) => d.roomId === roomId && d.name === name
      )?.[0] || null
    );
  }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
