const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files (HTML, CSS, JS, MP3s)
app.use(express.static(path.join(__dirname)));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html')); // Broadcaster page
});

app.get('/viewer', (req, res) => {
  res.sendFile(path.join(__dirname, 'viewer.html')); // Viewer page
});

let broadcasterSocket = null;

// WebRTC, Chat, Emoji, and Raise Hand Signaling
io.on('connection', (socket) => {
  console.log(`🔌 New Connection: ${socket.id}`);

  // Set broadcaster identity
  socket.on('broadcaster', () => {
    broadcasterSocket = socket.id;
    console.log(`🎥 Broadcaster set: ${socket.id}`);
  });

  // WebRTC: Offer from broadcaster
  socket.on('offer', (offer) => {
    console.log("📡 Offer from broadcaster");
    socket.broadcast.emit('offer', offer);
  });

  // WebRTC: Answer from viewer
  socket.on('answer', (answer) => {
    console.log("🔁 Answer from viewer");
    if (broadcasterSocket) {
      io.to(broadcasterSocket).emit('answer', answer);
    } else {
      console.warn("⚠️ No broadcaster available to receive answer.");
    }
  });

  // WebRTC: ICE Candidate
  socket.on('ice-candidate', (candidate) => {
    console.log("❄️ ICE Candidate shared");
    socket.broadcast.emit('ice-candidate', candidate);
  });

  // Chat message (from broadcaster or viewer)
  socket.on('chat', (msg, senderName) => {
    console.log(`💬 ${senderName}: ${msg}`);
    io.emit('chat', msg, senderName);
  });

  // Raise hand (viewer to broadcaster only)
  socket.on('raise-hand', (viewerName) => {
    console.log(`🙋‍♂️ ${viewerName} raised hand`);
    if (broadcasterSocket) {
      io.to(broadcasterSocket).emit('raise-hand', viewerName);
    }
  });

  // Emoji reaction
  socket.on('send-emoji', ({ viewerName, emoji }) => {
    console.log(`😄 Emoji from ${viewerName}: ${emoji}`);
    io.emit('receive-emoji', { viewerName, emoji });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    if (socket.id === broadcasterSocket) {
      broadcasterSocket = null;
      console.warn("🚫 Broadcaster has disconnected.");
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
