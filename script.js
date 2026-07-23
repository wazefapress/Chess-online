// استبدل الرابط أدناه برابط السيرفر الحقيقي الخاص بك على Render
var board = null;
var game = new Chess();
var timerInterval;
var timeLeftWhite = 300;
var timeLeftBlack = 300;
var gameMode = 'computer'; 
var roomCode = null;
const socket = io('https://chess-online-0crv.onrender.com');
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

function onDrop(source, target) {
    var move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';
    
    // تشغيل صوت الحركة فور إفلات القطعة في مكانها الصحيح
    moveSound.play();

    if (game.in_checkmate()) {
        handleGameOver(game.turn() === 'w' ? 'الأسود' : 'الأبيض');
    } else if (gameMode === 'computer') {
        setTimeout(makeComputerMove, 250);
    }
}

var config = {
    draggable: true,
    position: 'start',
    onDrop: onDrop,
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
};

function startGame() {
    game.reset();
    $('#start-screen').hide();
    $('#game-container').show();
    
    if (!board) {
        board = Chessboard('chessboard', config);
    } else {
        board.start();
        board.resize();
    }
    
    timeLeftWhite = 300;
    timeLeftBlack = 300;
    updateTimerDisplay('timer-white', timeLeftWhite);
    updateTimerDisplay('timer-black', timeLeftBlack);
    startTimer();
}

// تفعيل الأحداث بعد تحميل عناصر الصفحة بالكامل
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
        startGame();
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
            startGame();
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
        $('#game-container').hide();
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

