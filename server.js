const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname)));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html')); // Broadcaster
});

app.get('/viewer', (req, res) => {
  res.sendFile(path.join(__dirname, 'viewer.html'));
});

let broadcasterSocket = null;

// WebRTC + Chat + Emoji + Raise Hand
io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  socket.on('broadcaster', () => {
    broadcasterSocket = socket.id;
    console.log(`🎥 Broadcaster set: ${socket.id}`);
  });

  socket.on('offer', (offer) => {
    console.log("📡 Offer from broadcaster");
    socket.broadcast.emit('offer', offer);
  });

  socket.on('answer', (answer) => {
    console.log("🔁 Answer from viewer");
    if (broadcasterSocket) {
      io.to(broadcasterSocket).emit('answer', answer);
    } else {
      console.warn("⚠️ No broadcaster to send answer to.");
    }
  });

  socket.on('ice-candidate', (candidate) => {
    console.log("❄️ ICE candidate shared");
    socket.broadcast.emit('ice-candidate', candidate);
  });

  socket.on('chat', (msg, senderName) => {
    console.log(`💬 ${senderName}: ${msg}`);
    io.emit('chat', msg, senderName);
  });

  socket.on('raise-hand', (viewerName) => {
    console.log(`🙋‍♂️ ${viewerName} raised hand`);
    if (broadcasterSocket) {
      io.to(broadcasterSocket).emit('raise-hand', viewerName);
    }
  });

  socket.on('send-emoji', ({ viewerName, emoji }) => {
    console.log(`😄 Emoji from ${viewerName}: ${emoji}`);
    io.emit('receive-emoji', { viewerName, emoji });
  });

  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    if (socket.id === broadcasterSocket) {
      broadcasterSocket = null;
      console.warn("🚫 Broadcaster disconnected!");
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
