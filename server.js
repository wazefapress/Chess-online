const express = require('http');
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

// إذا أردت استضافة الملفات الثابتة مع السيرفر على نفس الخدمة في Render
app.use(express.static(path.join(__dirname, 'public')));

// تخزين الغرف وحالة اللاعبين
const rooms = {};

io.on('connection', (socket) => {
    console.log(`مستخدم متصل: ${socket.id}`);

    // انضمام أو إنشاء غرفة
    socket.on('join-room', (roomCode) => {
        if (!rooms[roomCode]) {
            rooms[roomCode] = { players: [] };
        }

        const room = rooms[roomCode];

        if (room.players.length < 2) {
            room.players.push(socket.id);
            socket.join(roomCode);

            // تحديد لون اللاعب (الأول أبيض، الثاني أسود)
            const color = room.players.length === 1 ? 'w' : 'b';
            socket.emit('player-assigned', color);

            console.log(`اللاعب ${socket.id} انضم للغرفة ${roomCode} بدور ${color}`);

            // إذا اكتمل اللاعبان، ابدأ اللعبة
            if (room.players.length === 2) {
                io.to(roomCode).start_game = true;
                io.to(roomCode).emit('start-game');
            }
        } else {
            socket.id.emit('room-full');
        }
    });

    // استقبال نقل الحركات وإرسالها للطرف الآخر
    socket.on('make-move', (data) => {
        socket.to(data.roomCode).emit('opponent-move', data.move);
    });

    // التعامل مع انقطاع الاتصال أو الخروج
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`السيرفر يعمل بنجاح على البورت ${PORT}`);
});