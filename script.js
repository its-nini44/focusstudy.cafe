let totalStudyMinutes = parseFloat(localStorage.getItem('focusKitchenTotalTime')) || 0;

function updateTotalTimeWidget() {
    let hoursDecimal = (totalStudyMinutes / 60).toFixed(1);
    const totalHoursEl = document.getElementById('total-hours');
    if (totalHoursEl) {
        totalHoursEl.innerText = hoursDecimal;
    }
}

const ambientAudio = document.getElementById('ambient-sound');
const volumeSlider = document.getElementById('volume-slider');

if (volumeSlider && ambientAudio) {
    volumeSlider.addEventListener('input', function() {
        ambientAudio.volume = this.value;
    });
}

// ========================================================
// WINDOW SWAPS
// ========================================================
document.getElementById('begin-btn').addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('top-ui-container').classList.remove('hidden');
    document.getElementById('game-widgets').classList.remove('hidden');
    updateTotalTimeWidget();
});

// ========================================================
// RECIPE GRIDS
// ========================================================
let countdownInterval = null;
let selectedMinutes = 15; 
let selectedFoodName = "Masala Chai";
let isTimerRunning = false; 

document.querySelectorAll('.food-card').forEach(card => {
    card.addEventListener('click', function() {
        if (isTimerRunning) return;

        document.querySelectorAll('.food-card').forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        
        selectedMinutes = parseFloat(this.getAttribute('data-mins'));
        selectedFoodName = this.getAttribute('data-name');
    });
});

// ========================================================
// TIMER ENGINES
// ========================================================
let targetEndTime; 
let totalSecondsTracked; 
let secondsRemainingSaved; 
let isPaused = false;

document.getElementById('start-btn').addEventListener('click', function() {
    clearInterval(countdownInterval);
    isPaused = false;
    isTimerRunning = true; 

    const pauseBtn = document.getElementById('pause-btn');
    pauseBtn.innerText = "⏸️ Pause Timer";
    pauseBtn.classList.remove('hidden-control'); 
    this.innerText = "🔄 Restart Cooking"; 

    if (ambientAudio && volumeSlider) {
        ambientAudio.currentTime = 0; 
        ambientAudio.volume = volumeSlider.value; 
        ambientAudio.play().catch(e => console.log("Audio deferred:", e));
    }

    totalSecondsTracked = selectedMinutes * 60;
    targetEndTime = Date.now() + (totalSecondsTracked * 1000);

    runClockIntervalLoop();
});

document.getElementById('pause-btn').addEventListener('click', function() {
    if (!isTimerRunning) return; 

    if (!isPaused) {
        isPaused = true;
        clearInterval(countdownInterval); 
        countdownInterval = null;
        this.innerText = "▶️ Resume Timer"; 
        if (ambientAudio) ambientAudio.pause(); 
        secondsRemainingSaved = Math.ceil((targetEndTime - Date.now()) / 1000);
    } else {
        isPaused = false;
        this.innerText = "⏸️ Pause Timer";
        if (ambientAudio) ambientAudio.play().catch(e => console.log(e));
        targetEndTime = Date.now() + (secondsRemainingSaved * 1000);
        runClockIntervalLoop(); 
    }
});

function runClockIntervalLoop() {
    updateTimerEngine();
    countdownInterval = setInterval(function() {
        const finished = updateTimerEngine();

        if (finished) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            isTimerRunning = false; 
            document.getElementById('timer-display').innerText = "00:00:00";
            document.getElementById('progress-display').innerText = "100% Cooked! 🎉";
            document.getElementById('pause-btn').classList.add('hidden-control'); 
            document.getElementById('start-btn').innerText = "Start Cooking & Studying";
            if (ambientAudio) ambientAudio.pause();
            triggerWellDoneEnding();
        }
    }, 100);
}

function updateTimerEngine() {
    const now = Date.now();
    const millisecondsLeft = targetEndTime - now;
    let secondsLeft = Math.ceil(millisecondsLeft / 1000);

    if (secondsLeft <= 0) return true; 

    let hours = Math.floor(secondsLeft / 3600);
    let minutes = Math.floor((secondsLeft % 3600) / 60);
    let seconds = secondsLeft % 60;

    let hDisplay = hours < 10 ? "0" + hours : hours;
    let mDisplay = minutes < 10 ? "0" + minutes : minutes;
    let sDisplay = seconds < 10 ? "0" + seconds : seconds;

    document.getElementById('timer-display').innerText = `${hDisplay}:${mDisplay}:${sDisplay}`;

    let timeElapsed = totalSecondsTracked - secondsLeft;
    let percentCooked = Math.floor((timeElapsed / totalSecondsTracked) * 100);
    
    if (percentCooked < 0) percentCooked = 0;
    if (percentCooked > 100) percentCooked = 100;
    document.getElementById('progress-display').innerText = `${percentCooked}% Cooked`;
    
    return false;
}

function triggerWellDoneEnding() {
    document.getElementById('session-summary-text').innerText = `You have successfully completed your ${selectedFoodName} cooking block!`;
    document.getElementById('added-time-text').innerText = `+${Math.floor(selectedMinutes)} Mins Logged`;

    totalStudyMinutes += selectedMinutes;
    localStorage.setItem('focusKitchenTotalTime', totalStudyMinutes);
    updateTotalTimeWidget();

    const endingScreen = document.getElementById('ending-screen');
    if (endingScreen) {
        endingScreen.classList.remove('hidden-modal');
    }
}

document.getElementById('close-end-btn').addEventListener('click', function() {
    const endingScreen = document.getElementById('ending-screen');
    if (endingScreen) {
        endingScreen.classList.add('hidden-modal');
    }
});

// ========================================================
// 💬 STABLE SERVER-SENT EVENTS INSTANT CHAT (NTFY POWERED)
// ========================================================
const toggleChatBtn = document.getElementById('toggle-chat-btn');
const chatPanel = document.getElementById('kitchen-chat-box');

if (toggleChatBtn && chatPanel) {
    toggleChatBtn.addEventListener('click', function(e) {
        e.preventDefault();
        chatPanel.classList.toggle('hidden-chat');
    });
}

const sendBtn = document.getElementById('chat-send-btn');
const msgInput = document.getElementById('chat-user-message');
const streamEl = document.getElementById('chat-messages-stream');

// Secure public communication frequency string
const NTFY_TOPIC_ROOM = "focus_kitchen_stream_channel_999";
const STREAM_SUBSCRIBE_URL = `https://ntfy.sh{NTFY_TOPIC_ROOM}/sse`;
const BROADCAST_PUBLISH_URL = `https://ntfy.sh{NTFY_TOPIC_ROOM}`;

// Initialize native browser background stream listener
const networkStreamReader = new EventSource(STREAM_SUBSCRIBE_URL);

networkStreamReader.onmessage = function(event) {
    if (!streamEl) return;
    
    try {
        const payloadData = JSON.parse(event.data);
        // The message string is sent as the core text property of the packet
        const messagePayload = JSON.parse(payloadData.message);

        if (!messagePayload.username || !messagePayload.message) return;

        const bubble = document.createElement('div');
        bubble.className = "chat-bubble-row";
        bubble.innerHTML = `<strong>${messagePayload.username}:</strong> ${messagePayload.message}`;
        
        streamEl.appendChild(bubble);
        
        // Instant layout adjustment alignment
        setTimeout(function() {
            streamEl.scrollTop = streamEl.scrollHeight;
        }, 10);
    } catch (err) {
        // Soft catch for system test packets sent by server on connection start
    }
};

if (sendBtn) {
    sendBtn.addEventListener('click', function(e) {
        e.preventDefault();
        transmitInstantMessage();
    });
}

if (msgInput) {
    msgInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            transmitInstantMessage();
        }
    });
}

function transmitInstantMessage() {
    const nameInput = document.getElementById('chat-user-name');
    const msgInput = document.getElementById('chat-user-message');
    
    if (!msgInput) return;

    let chefName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : "Anonymous Chef";
    let messageText = msgInput.value.trim();

    if (!messageText) return; 

    const bodyPayload = {
        username: chefName,
        message: messageText
    };

    // Use a standard secure background network request to instantly beam message out
    fetch(BROADCAST_PUBLISH_URL, {
        method: 'POST',
        body: JSON.stringify(bodyPayload)
    })
    .then(() => {
        msgInput.value = "";
    })
    .catch(err => console.log("Network drop out:", err));
}

// 🧹 INITIAL CLEAR UP ON PAGE RELOAD
const nameField = document.getElementById('chat-user-name');
const msgField = document.getElementById('chat-user-message');
const streamField = document.getElementById('chat-messages-stream');

if (nameField) nameField.value = "";
if (msgField) msgField.value = "";
if (streamField) streamField.innerHTML = "";
