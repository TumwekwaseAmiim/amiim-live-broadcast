const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve all static assets (HTML, CSS, JS, MP3)
app.use(express.static(path.join(__dirname)));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html')); // Broadcaster
});

app.get('/viewer', (req, res) => {
  res.sendFile(path.join(__dirname, 'viewer.html'));
});

// WebRTC + Chat Logic
io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  socket.on('offer', (offer) => {
    console.log("📡 Offer from broadcaster");
    socket.broadcast.emit('offer', offer);
  });

  socket.on('answer', (answer) => {
    console.log("🔁 Answer from viewer");
    socket.broadcast.emit('answer', answer);
  });

  socket.on('ice-candidate', (candidate) => {
    console.log("❄️ ICE candidate shared");
    socket.broadcast.emit('ice-candidate', candidate);
  });

  socket.on('chat', (msg, senderName) => {
    io.emit('chat', msg, senderName); // Global chat
  });

  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
