// استبدل الرابط أدناه برابط السيرفر الحقيقي الخاص بك على Render
const socket = io('https://chess-online-0t7v.onrender.com');
var board = null;
var game = new Chess();
var timerInterval;
var timeLeftWhite = 300;
var timeLeftBlack = 300;
var gameMode = 'computer'; 
var roomCode = null;
var playerColor = 'w'; // لون اللاعب الافتراضي

// تعريف مؤثر صوت التحريك باستخدام رابط مباشر وصريح لملف صوتي صالح
const moveSound = new Howl({ 
    src: ['move.mp3'],
    html5: true
});

const winSound = new Howl({ 
    src: ['game-end.wav'],
    html5: true
});

function updateTimerDisplay(id, time) {
    let mins = Math.floor(time / 60);
    let secs = time % 60;
    let prefix = id === 'timer-white' ? 'الأبيض' : 'الأسود';
    document.getElementById(id).innerText = `${prefix}: ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (game.game_over()) return;
        if (game.turn() === 'w') {
            timeLeftWhite--;
            updateTimerDisplay('timer-white', timeLeftWhite);
            if (timeLeftWhite <= 0) handleGameOver('الأسود');
        } else {
            timeLeftBlack--;
            updateTimerDisplay('timer-black', timeLeftBlack);
            if (timeLeftBlack <= 0) handleGameOver('الأبيض');
        }
    }, 1000);
}

function handleGameOver(winner) {
    clearInterval(timerInterval);
    winSound.play();
    if (typeof confetti === 'function') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
    alert(`انتهت اللعبة! الفائز هو: ${winner}`);
}

function makeComputerMove() {
    if (game.game_over()) return;
    var possibleMoves = game.moves();
    if (possibleMoves.length === 0) return;
    
    var randomIdx = Math.floor(Math.random() * possibleMoves.length);
    game.move(possibleMoves[randomIdx]);
    board.position(game.fen());
    
    // تشغيل صوت الحركة عند تحرك الكمبيوتر
    moveSound.play();
    
    if (game.in_checkmate()) {
        handleGameOver(game.turn() === 'w' ? 'الأسود' : 'الأبيض');
    }
}

// دالة التحقق من أحقية الحركة
function onDragStart(source, piece, position, orientation) {
    if (game.game_over()) return false;
    
    if (gameMode === 'online') {
        // منع اللاعب من اللعب في غير دوره أو تحريك قطع الخصم
        if (game.turn() !== playerColor || piece.search(new RegExp(`^${playerColor}`)) === -1) {
            return false;
        }
    } else {
        // في وضع الكمبيوتر، اللاعب دائماً أبيض
        if (game.turn() === 'b' && piece.search(/^w/) === -1) return false;
    }
}

function onDrop(source, target) {
    var move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';
    
    // تشغيل صوت الحركة فور إفلات القطعة في مكانها الصحيح
    moveSound.play();

    if (game.in_checkmate()) {
        handleGameOver(game.turn() === 'w' ? 'الأسود' : 'الأبيض');
    } else {
        if (gameMode === 'online') {
            // إرسال الحركة للسيرفر
            socket.emit('make-move', { roomCode: roomCode, move: move });
        } else if (gameMode === 'computer') {
            setTimeout(makeComputerMove, 250);
        }
    }
}

var config = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
};

function startGame() {
    game.reset();
    $('#start-screen').hide();
    
    // إزالة أي رسائل انتظار سابقة
    $('#waiting-message').remove();
    
    // عرض حاوية اللعبة بتنسيق عمودي صريح
    $('#game-container').css({
        'display': 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        'justify-content': 'center'
    }).show();
    
    if (!board) {
        board = Chessboard('chessboard', config);
    } else {
        board.start();
    }

    // قلب الرقعة عمودياً لتناسب واجهة المستخدم بناءً على لونه
    if (gameMode === 'online') {
        board.orientation(playerColor === 'b' ? 'black' : 'white');
    } else {
        board.orientation('white');
    }
    
    board.resize();
    
    timeLeftWhite = 300;
    timeLeftBlack = 300;
    updateTimerDisplay('timer-white', timeLeftWhite);
    updateTimerDisplay('timer-black', timeLeftBlack);
    startTimer();
}

// ===================================
// === أحداث السيرفر (Socket.io) ===
// ===================================

socket.on('player-assigned', function(color) {
    playerColor = color;
});

socket.on('start-game', function() {
    startGame();
});

socket.on('opponent-move', function(move) {
    game.move(move);
    board.position(game.fen());
    moveSound.play();
    if (game.in_checkmate()) {
        handleGameOver(game.turn() === 'w' ? 'الأسود' : 'الأبيض');
    }
});

socket.on('room-full', function() {
    alert('عذراً، الغرفة ممتلئة.');
    $('#waiting-message').text('الغرفة ممتلئة. يرجى المحاولة مرة أخرى.');
});

socket.on('opponent-disconnected', function() {
    alert('انسحب الخصم! لقد فزت.');
    clearInterval(timerInterval);
});

// ===================================
// === أحداث الواجهة (UI Events) ===
// ===================================

$(document).ready(function() {
    $('#vs-computer-btn').on('click', function() {
        gameMode = 'computer';
        $('#room-display').hide();
        startGame();
    });

    $('#online-btn').on('click', function() {
        gameMode = 'online';
        roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        $('#current-room-code').text(roomCode);
        $('#room-display').show();
        
        socket.emit('join-room', roomCode);
        
        $('#start-screen').hide();
        
        $('#game-container').css({
            'display': 'flex',
            'flex-direction': 'column',
            'align-items': 'center'
        }).show().append('<h3 id="waiting-message" style="margin-top: 20px;">في انتظار انضمام الخصم...</h3>');
        
        // إخفاء الرقعة مؤقتاً حتى تكتمل الغرفة
        $('#chessboard').hide();
        $('.timers').hide();
    });

    $('#join-btn').on('click', function() {
        $('#join-modal').show();
    });

    $('#close-join-btn').on('click', function() {
        $('#join-modal').hide();
    });

    $('#connect-room-btn').on('click', function() {
        let code = $('#room-code-input').val().trim();
        if (code) {
            gameMode = 'online';
            roomCode = code;
            $('#current-room-code').text(roomCode);
            $('#room-display').show();
            $('#join-modal').hide();
            
            socket.emit('join-room', roomCode);
            
            $('#start-screen').hide();
            $('#game-container').css({
                'display': 'flex',
                'flex-direction': 'column',
                'align-items': 'center'
            }).show().append('<h3 id="waiting-message" style="margin-top: 20px;">جاري الاتصال بالغرفة...</h3>');
            
            $('#chessboard').hide();
            $('.timers').hide();
        } else {
            alert('الرجاء إدخال كود غرفة صحيح.');
        }
    });

    $('#copy-room-code-btn').on('click', function() {
        if (roomCode) {
            navigator.clipboard.writeText(roomCode).then(() => {
                let $btn = $(this);
                let originalText = $btn.text();
                $btn.text('✓ تم النسخ!');
                setTimeout(() => { $btn.text(originalText); }, 2000);
            }).catch(() => {
                let $temp = $("<input>");
                $("body").append($temp);
                $temp.val(roomCode).select();
                document.execCommand("copy");
                $temp.remove();
                alert('تم نسخ الكود: ' + roomCode);
            });
        }
    });

    $('#rules-btn').on('click', function() {
        $('#rules-modal').show();
    });

    $('#close-rules-btn').on('click', function() {
        $('#rules-modal').hide();
    });

    $('#leave-room-btn').on('click', function() {
        clearInterval(timerInterval);
        
        // فصل الاتصال الحالي وإنشاء جلسة جديدة لتنظيف الغرفة السابقة
        socket.disconnect(); 
        setTimeout(() => socket.connect(), 500); 
        
        $('#waiting-message').remove();
        $('#game-container').hide();
        $('#chessboard').show(); // إعادة الإظهار للعب لاحقاً
        $('.timers').show();
        $('#start-screen').show();
    });

    $('#share-btn').on('click', function() {
        if (navigator.share) {
            navigator.share({ title: 'شطرنج المحترفين', url: window.location.href }).catch(() => {});
        } else {
            alert('رابط اللعبة: ' + window.location.href);
        }
    });
});

$(window).resize(function() {
    if (board) board.resize();
});