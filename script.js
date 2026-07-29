// عدم الاتصال التلقائي المباشر لمنع تجميد الصفحة، والاتصال عند الحاجة
//let socket = null;
//function initSocket() {
  //  if (!socket) {
      //  socket = io('https://chess-online-0t7v.onrender.com', {
        //   reconnectionAttempts: 3,
        //  timeout: 5000
    //    });

        // ربط أحداث السيرفر هنا لتجنب تكرارها
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
    }
}

var board = null;
var game = new Chess();
var timerInterval;
var timeLeftWhite = 300;
var timeLeftBlack = 300;
var gameMode = 'computer'; 
var roomCode = null;
var playerColor = 'w';

const moveSound = new Howl({ src: ['move.mp3'], html5: true });
const winSound = new Howl({ src: ['game-end.wav'], html5: true });

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
    moveSound.play();
    
    if (game.in_checkmate()) {
        handleGameOver(game.turn() === 'w' ? 'الأسود' : 'الأبيض');
    }
}

function onDragStart(source, piece, position, orientation) {
    if (game.game_over()) return false;
    if (gameMode === 'online') {
        if (game.turn() !== playerColor || piece.search(new RegExp(`^${playerColor}`)) === -1) {
            return false;
        }
    } else {
        if (game.turn() === 'b' && piece.search(/^w/) === -1) return false;
    }
}

function onDrop(source, target) {
    var move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';
    
    moveSound.play();

    if (game.in_checkmate()) {
        handleGameOver(game.turn() === 'w' ? 'الأسود' : 'الأبيض');
    } else {
        if (gameMode === 'online' && socket) {
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
    $('#waiting-message').remove();
    
    $('#game-container').css({
        'display': 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        'justify-content': 'center'
    }).show();
    
    $('#chessboard').show();
    $('.timers').show();

    // تأخير بسيط لضمان قياس المتصفح لأبعاد الرقعة وإظهارها بشكل سليم
    setTimeout(() => {
        if (!board) {
            board = Chessboard('chessboard', config);
        } else {
            board.start();
        }

        if (gameMode === 'online') {
            board.orientation(playerColor === 'b' ? 'black' : 'white');
        } else {
            board.orientation('white');
        }
        
        board.resize();
    }, 100);
    
    timeLeftWhite = 300;
    timeLeftBlack = 300;
    updateTimerDisplay('timer-white', timeLeftWhite);
    updateTimerDisplay('timer-black', timeLeftBlack);
    startTimer();
}

// أحداث الواجهة
$(document).ready(function() {
    $('#vs-computer-btn').on('click', function() {
        gameMode = 'computer';
        $('#room-display').hide();
        startGame();
    });

    $('#online-btn').on('click', function() {
        gameMode = 'online';
        initSocket(); // الاتصال فقط عند الحاجة
        
        roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        $('#current-room-code').text(roomCode);
        $('#room-display').show();
        
        if (socket) socket.emit('join-room', roomCode);
        
        $('#start-screen').hide();
        $('#game-container').css({
            'display': 'flex',
            'flex-direction': 'column',
            'align-items': 'center'
        }).show().append('<h3 id="waiting-message" style="margin-top: 20px; color: white;">في انتظار انضمام الخصم...</h3>');
        
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
            initSocket(); // الاتصال فقط عند الحاجة
            
            roomCode = code;
            $('#current-room-code').text(roomCode);
            $('#room-display').show();
            $('#join-modal').hide();
            
            if (socket) socket.emit('join-room', roomCode);
            
            $('#start-screen').hide();
            $('#game-container').css({
                'display': 'flex',
                'flex-direction': 'column',
                'align-items': 'center'
            }).show().append('<h3 id="waiting-message" style="margin-top: 20px; color: white;">جاري الاتصال بالغرفة...</h3>');
            
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
        if (socket) {
            socket.disconnect();
            socket = null;
        }
        $('#waiting-message').remove();
        $('#game-container').hide();
        $('#chessboard').show();
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
});.
