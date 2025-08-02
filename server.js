const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files (like CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// Serve broadcaster.html when accessing the root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'broadcaster.html'));
});

// Serve viewer.html when accessing /viewer
app.get('/viewer', (req, res) => {
  res.sendFile(path.join(__dirname, 'viewer.html'));
});

// Store connected viewers
let viewers = [];

io.on('connection', (socket) => {
  console.log('A user connected');

  // Add the viewer to the list
  viewers.push(socket.id);
  io.emit('viewer-connected', viewers.length); // Notify the broadcaster about the number of viewers

  // When the broadcaster sends an offer, broadcast it to all viewers
  socket.on('offer', (offer) => {
    socket.broadcast.emit('offer', offer);
  });

  // When a viewer sends an answer, send it to the broadcaster
  socket.on('answer', (answer) => {
    socket.broadcast.emit('answer', answer);
  });

  // When a viewer sends an ICE candidate, broadcast it to the other peer
  socket.on('ice-candidate', (candidate) => {
    socket.broadcast.emit('ice-candidate', candidate);
  });

  // Handle chat messages from viewers
  socket.on('chat', (msg, senderName) => {
    io.emit('chat', msg, senderName); // Broadcast the message to all viewers and broadcaster
  });

  // Handle viewer disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected');
    viewers = viewers.filter(id => id !== socket.id); // Remove the disconnected viewer
    io.emit('viewer-disconnected', viewers.length); // Update the broadcaster on remaining viewers
  });
});

// Start the server on port 3000
server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
