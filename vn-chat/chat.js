// vn-chat/script.js
// Versi: Final Complete + Delete History & Copy Feature

// --- 1. GLOBAL VARIABLES ---
let currentCharacterId = "1";
let currentCharacterName = "MAI";
let currentCharacterProfile = "MAI default.";
let currentUser = null; 
let currentSessionId = ''; 
let currentEmotion = 'IDLE';

const sprites = {
    'IDLE': '/vn-chat/img/char/bri/idle.png',
    'HAPPY': '/vn-chat/img/char/bri/idle.png',
    'SAD': '/vn-chat/img/char/bri/idle.png',
    'ANGRY': '/vn-chat/img/char/bri/idle.png',
    'SURPRISED': '/vn-chat/img/char/bri/idle.png',
    'SHY': '/vn-chat/img/char/bri/idle.png',
    'THINKING': '/vn-chat/img/char/bri/idle.png',
};

// --- 2. HELPER FUNCTIONS ---

function generateUUID() {
    return 'vn-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Helper Konfirmasi Cantik (Sama seperti di Lobby)
function showCustomConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        if (!modal) { resolve(confirm(message)); return; } // Fallback

        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-msg').textContent = message;
        
        // Reset tombol (kloning untuk hapus listener lama)
        const yesBtn = document.getElementById('btn-confirm-yes');
        const noBtn = document.getElementById('btn-confirm-cancel');
        const newYes = yesBtn.cloneNode(true);
        const newNo = noBtn.cloneNode(true);
        yesBtn.parentNode.replaceChild(newYes, yesBtn);
        noBtn.parentNode.replaceChild(newNo, noBtn);

        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('visible'), 10);

        const close = (res) => {
            modal.classList.remove('visible');
            setTimeout(() => modal.style.display = 'none', 300);
            resolve(res);
        };

        newYes.onclick = () => close(true);
        newNo.onclick = () => close(false);
    });
}

// Toast Notifikasi Sederhana
function showToast(msg) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = msg;
        toast.classList.add('visible');
        
        // Hilangkan setelah 2 detik
        setTimeout(() => {
            toast.classList.remove('visible');
        }, 2000);
    } else {
        // Fallback jika elemen tidak ada
        alert(msg);
    }
}

function typewriter(text) {
    const el = document.getElementById('dialogue-text');
    if(!el) return;
    el.textContent = ""; 
    let i = 0;
    const speed = 25; 

    function type() {
        if (i < text.length) {
            el.textContent += text.charAt(i); 
            i++;
            setTimeout(type, speed);
        } else {
            enableInput(true);
        }
    }
    type();
}

function enableInput(enabled) {
    const input = document.getElementById('user-input');
    const btn = document.getElementById('btn-send');
    if(input) {
        input.disabled = !enabled;
        if(enabled) input.focus();
    }
    if(btn) btn.disabled = !enabled;
}

function updateSprite(emotion) {
    const normalizedEmotion = emotion in sprites ? emotion : 'IDLE';
    const imgEl = document.getElementById('char-sprite');
    const newSrc = sprites[normalizedEmotion];

    if (imgEl && imgEl.src !== newSrc) {
        imgEl.style.opacity = 0; 
        setTimeout(() => {
            imgEl.src = newSrc;
            imgEl.style.opacity = 1; 
        }, 150);
        currentEmotion = normalizedEmotion;
    }
}

function parseReply(rawText) {
    let cleanText = rawText;
    let emotion = 'IDLE';
    const match = rawText && rawText.match(/^\[([A-Z]+)\]/);
    if (match) {
        emotion = match[1];
        cleanText = rawText.replace(match[0], '').trim();
    }
    return { emotion, cleanText: cleanText || "" };
}

// --- 3. LOAD DATA & HISTORY ---

async function loadCharacterAndState() {
    try {
        const res = await fetch(`/.netlify/functions/get-character?id=${currentCharacterId}`);
        if (!res.ok) throw new Error("Karakter tidak ditemukan");
        const char = await res.json();
        
        currentCharacterProfile = char.description; 
        currentCharacterName = char.name;

        document.getElementById('char-name').textContent = char.name;

        if (char.image) {
            const spriteEl = document.getElementById('char-sprite');
            if(spriteEl) spriteEl.src = char.image;
            Object.keys(sprites).forEach(key => { sprites[key] = char.image; });
        }

        if (char.backgroundImage) {
            document.querySelector('.vn-background').style.backgroundImage = `url('${char.backgroundImage}')`;
        }

        if (currentUser) {
            const token = await currentUser.getIdToken();
            const histRes = await fetch(`/.netlify/functions/get-history?id=${currentCharacterId}&sessionId=${currentSessionId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const history = await histRes.json();

            if (history && history.length > 0) {
                const lastMsg = history[history.length - 1];
                const { emotion, cleanText } = parseReply(lastMsg.text);
                updateSprite(emotion);
                
                if (lastMsg.sender === 'user') typewriter(`(Kamu): ${cleanText}`);
                else typewriter(cleanText);
            } else {
                typewriter(char.greeting || `Halo! Aku ${char.name}.`);
            }
        }
    } catch (e) {
        console.error("Gagal load:", e);
        document.getElementById('dialogue-text').textContent = "Gagal memuat data.";
        enableInput(true); 
    }
}

// --- 4. LOG / HISTORY UI & ACTIONS ---

async function openLog() {
    const logOverlay = document.getElementById('log-overlay');
    const logContent = document.getElementById('log-content');
    if(!logOverlay || !logContent) return;

    logOverlay.classList.remove('hidden');
    logContent.innerHTML = '<p style="text-align:center;">Memuat memori...</p>';

    try {
        const token = await currentUser.getIdToken();
        const res = await fetch(`/.netlify/functions/get-history?id=${currentCharacterId}&sessionId=${currentSessionId}`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        const history = await res.json();
        
        logContent.innerHTML = ''; 

        if (history.length === 0) {
            logContent.innerHTML = '<p style="text-align:center; opacity:0.7;">Belum ada percakapan.</p>';
        } else {
            history.forEach(msg => {
                const item = document.createElement('div');
                const senderClass = msg.sender === 'user' ? 'user' : 'bot';
                item.className = `log-item ${senderClass}`;
                
                const senderName = msg.sender === 'user' ? 'Kamu' : currentCharacterName;
                const { cleanText } = parseReply(msg.text);

                // Buat struktur pesan
                const nameDiv = document.createElement('div');
                nameDiv.className = 'log-sender';
                nameDiv.textContent = senderName;

                const textDiv = document.createElement('div');
                textDiv.className = 'log-text';
                textDiv.textContent = cleanText;

                // Tombol Copy
                const copyBtn = document.createElement('button');
                copyBtn.className = 'log-copy-btn';
                copyBtn.innerHTML = '📋'; // Icon papan klip
                copyBtn.title = "Salin Teks";
                copyBtn.onclick = () => {
                    navigator.clipboard.writeText(cleanText);
                    // Ubah icon sesaat
                    copyBtn.innerHTML = '✅';
                    setTimeout(() => copyBtn.innerHTML = '📋', 1000);
                };

                item.appendChild(nameDiv);
                item.appendChild(textDiv);
                item.appendChild(copyBtn);

                logContent.appendChild(item);
            });
            logContent.scrollTop = logContent.scrollHeight;
        }

    } catch (e) {
        logContent.innerHTML = '<p style="text-align:center; color:#ff6b6b;">Gagal memuat riwayat.</p>';
    }
}

function closeLog() {
    document.getElementById('log-overlay').classList.add('hidden');
}

async function deleteHistory() {
    // 1. Konfirmasi
    const isSure = await showCustomConfirm(
        "Hapus Memori?", 
        "Tindakan ini akan menghapus semua percakapan di sesi ini secara permanen. Mulai ulang?"
    );

    if (!isSure) return;

    closeLog();
    document.getElementById('dialogue-text').innerText = "Menghapus ingatan...";
    
    try {
        const token = await currentUser.getIdToken();
        // Panggil backend untuk hapus data di Firestore
        const res = await fetch(`/.netlify/functions/delete-history?id=${currentCharacterId}&sessionId=${currentSessionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Gagal menghapus data server");

        // 2. Reset Sesi Lokal
        // Hapus dari localStorage
        const storageKey = `vn_session_${currentUser.uid}_${currentCharacterId}`;
        localStorage.removeItem(storageKey);
        
        // Buat ID baru
        currentSessionId = generateUUID();
        localStorage.setItem(storageKey, currentSessionId);

        // 3. Reset UI ke Awal
        currentEmotion = 'IDLE';
        updateSprite('IDLE');
        
        // Tampilkan pesan reset
        document.getElementById('dialogue-text').innerText = "*Memori telah direset.*";
        setTimeout(() => {
            loadCharacterAndState(); // Load ulang sapaan awal
        }, 1500);

    } catch (e) {
        console.error(e);
        alert("Gagal menghapus: " + e.message);
        document.getElementById('dialogue-text').innerText = "Gagal reset.";
    }
}

// --- 5. MAIN CHAT LOGIC ---

async function sendMessage() {
    const input = document.getElementById('user-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    enableInput(false); 
    document.getElementById('dialogue-text').innerText = "..."; 

    try {
        if (!currentUser) throw new Error("Sesi habis, silakan refresh.");
        const token = await currentUser.getIdToken();

        const res = await fetch('/.netlify/functions/get-chat-response-vn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                userMessage: text,
                characterProfile: currentCharacterProfile,
                characterName: currentCharacterName,
                characterId: currentCharacterId,
                sessionId: currentSessionId
            })
        });

        if (!res.ok) throw new Error("Gagal respon server (" + res.status + ")");

        saveMessage('user', text); 

        const data = await res.json();
        const { emotion, cleanText } = parseReply(data.reply);

        updateSprite(emotion);
        typewriter(cleanText);
        saveMessage('bot', data.reply); 

    } catch (e) {
        console.error(e);
        document.getElementById('dialogue-text').innerText = "Error: " + e.message;
        enableInput(true); 
    }
}

async function saveMessage(sender, text) {
    try {
        if(!currentUser) return;
        const token = await currentUser.getIdToken();
        await fetch('/.netlify/functions/save-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ characterId: currentCharacterId, sender, text, sessionId: currentSessionId })
        });
    } catch (e) { console.error("Gagal simpan:", e); }
}

// --- 6. INITIALIZATION ---

function initVN() {
    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get('id');
    if (!idFromUrl) {
        alert("ID tidak valid");
        window.location.href = 'lobby.html';
        return;
    }
    currentCharacterId = idFromUrl;

    const storageKey = `vn_session_${currentUser.uid}_${currentCharacterId}`;
    const savedSession = localStorage.getItem(storageKey);
    if (savedSession) {
        currentSessionId = savedSession;
    } else {
        currentSessionId = generateUUID();
        localStorage.setItem(storageKey, currentSessionId);
    }

    loadCharacterAndState();
}

document.addEventListener('DOMContentLoaded', () => {
    const btnSend = document.getElementById('btn-send');
    const input = document.getElementById('user-input');
    const btnLog = document.getElementById('btn-log');
    const btnCloseLog = document.getElementById('close-log');
    const btnDeleteHistory = document.getElementById('btn-delete-history'); // Tombol Hapus Baru

    if (btnSend) btnSend.addEventListener('click', sendMessage);
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
    if (btnLog) btnLog.addEventListener('click', openLog);
    if (btnCloseLog) btnCloseLog.addEventListener('click', closeLog);
    if (btnDeleteHistory) btnDeleteHistory.addEventListener('click', deleteHistory); // Listener Hapus

    const checkAuth = () => {
        const user = firebase.auth().currentUser;
        if (user) {
            currentUser = user;
            initVN();
        } else {
            firebase.auth().onAuthStateChanged((u) => {
                if (u) {
                    currentUser = u;
                    initVN();
                } else {
                    window.location.href = '../login.html';
                }
            });
        }
    };
    
    checkAuth();
});