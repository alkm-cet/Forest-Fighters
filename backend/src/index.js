require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const { setIo } = require('./socket');

const authRoutes = require('./routes/auth');
const resourceRoutes = require('./routes/resources');
const championRoutes = require('./routes/champions');
const farmerRoutes = require('./routes/farmers');
const dungeonRoutes = require('./routes/dungeons');
const pvpRoutes = require('./routes/pvp');
const animalRoutes = require('./routes/animals');
const farmRoutes   = require('./routes/farms');
const coinRoutes = require('./routes/coins');
const playerRoutes = require('./routes/players');

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*' },
});

setIo(io);

io.on('connection', (socket) => {
  socket.on('join', ({ playerId }) => {
    if (playerId) socket.join(`player:${playerId}`);
  });
});

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/champions', championRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/dungeons', dungeonRoutes);
app.use('/api/pvp', pvpRoutes);
app.use('/api/animals', animalRoutes);
app.use('/api/farms',   farmRoutes);
app.use('/api/coins', coinRoutes);
app.use('/api/players', playerRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
