const express = require('express'); // تم التصحيح
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
    console.log(`مستخدم متصل: ${socket.id}`);

    socket.on('join-room', (roomCode) => {
        if (!rooms[roomCode]) {
            rooms[roomCode] = { players: [] };
        }

        const room = rooms[roomCode];

        if (room.players.length < 2) {
            room.players.push(socket.id);
            socket.join(roomCode);

            const color = room.players.length === 1 ? 'w' : 'b';
            socket.emit('player-assigned', color);

            console.log(`اللاعب ${socket.id} انضم للغرفة ${roomCode} بدور ${color}`);

            if (room.players.length === 2) {
                io.to(roomCode).start_game = true;
                io.to(roomCode).emit('start-game');
            }
        } else {
            socket.emit('room-full'); // تم التصحيح
        }
    });

    socket.on('make-move', (data) => {
        socket.to(data.roomCode).emit('opponent-move', data.move);
    });

    socket.on('disconnect', () => {
        console.log(`مستخدم غادر: ${socket.id}`);
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            room.players = room.players.filter(id => id !== socket.id);
            if (room.players.length === 0) {
                delete rooms[roomCode];
            } else {
                io.to(roomCode).emit('opponent-disconnected');
            }
        }
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`السيرفر يعمل بنجاح على البورت ${PORT}`);
});