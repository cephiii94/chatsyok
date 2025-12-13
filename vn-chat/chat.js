// vn-chat/chat.js
// VERSI FINAL: Recovery Sesi + User Persona + Settings UI + Custom Alerts

// --- 1. GLOBAL VARIABLES ---
let currentCharacterId = "1";
let currentCharacterName = "MAI";
let currentCharacterProfile = "MAI default.";
let currentUser = null; 
let currentSessionId = ''; 
let currentEmotion = 'IDLE';

// Persona User Default
let currentUserName = "Teman"; 
let currentUserPersona = "";   

// Sprite default
const sprites = {
    'IDLE': '', 
    'HAPPY': '', 'SAD': '', 'ANGRY': '',
    'SURPRISED': '', 'SHY': '', 'THINKING': ''
};

// --- 2. HELPER FUNCTIONS ---

function generateUUID() {
    return 'vn-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// FUNGSI BARU: Custom Alert Cantik
function showNotification(title, message) {
    const modal = document.getElementById('custom-alert-modal');
    if (modal) {
        document.getElementById('alert-title').innerText = title || "Info";
        document.getElementById('alert-msg').innerText = message;
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    } else {
        // Fallback jika modal tidak ada
        alert(`${title}: ${message}`);
    }
}

function showCustomConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        if (!modal) { resolve(confirm(message)); return; }

        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-msg').textContent = message;
        
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
    const key = emotion ? emotion.toUpperCase() : 'IDLE';
    const validEmotion = (key in sprites) ? key : 'IDLE';
    
    let newSrc = sprites[validEmotion] || sprites['IDLE'];
    const imgEl = document.getElementById('char-sprite');

    // console.log(`[VN] Updating sprite: Emotion=${key}, Valid=${validEmotion}, Src=${newSrc}`);

    if (imgEl) {
        imgEl.onerror = () => {
            // console.error(`[VN] Failed to load image: ${newSrc}`);
            if (imgEl.src !== 'https://placehold.co/400x600?text=Image+Not+Found') {
                imgEl.src = 'https://placehold.co/400x600?text=Image+Not+Found';
            }
        };

        if (imgEl.src !== newSrc) {
            imgEl.style.opacity = 0; 
            setTimeout(() => {
                imgEl.src = newSrc;
                imgEl.style.opacity = 1; 
            }, 150);
            currentEmotion = validEmotion;
        }
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

// --- 3. LOAD DATA & SETTINGS ---

function loadSettings() {
    const savedName = localStorage.getItem('vn_username');
    const savedPersona = localStorage.getItem('vn_persona');
    
    if (savedName) currentUserName = savedName;
    if (savedPersona) currentUserPersona = savedPersona;

    const nameInput = document.getElementById('setting-username');
    const personaInput = document.getElementById('setting-persona');
    if (nameInput) nameInput.value = currentUserName;
    if (personaInput) personaInput.value = currentUserPersona;
}

function saveSettings() {
    const nameInput = document.getElementById('setting-username').value.trim();
    const personaInput = document.getElementById('setting-persona').value.trim();

    if (nameInput) {
        currentUserName = nameInput;
        localStorage.setItem('vn_username', currentUserName);
    }
    
    currentUserPersona = personaInput;
    localStorage.setItem('vn_persona', currentUserPersona);

    document.getElementById('settings-overlay').classList.add('hidden');
    // MENGGUNAKAN NOTIFIKASI BARU
    showNotification("Sukses", "Pengaturan user berhasil disimpan!");
}

async function loadCharacterAndState() {
    try {
        const res = await fetch(`/.netlify/functions/get-character?id=${currentCharacterId}`);
        if (!res.ok) throw new Error("Karakter tidak ditemukan");
        const char = await res.json();
        
        currentCharacterProfile = char.description; 
        currentCharacterName = char.name;

        document.getElementById('char-name').textContent = char.name;

        const defaultImg = char.image || "https://via.placeholder.com/400x600?text=No+Image";
        Object.keys(sprites).forEach(k => sprites[k] = defaultImg);

        if (char.sprites) {
            if (char.sprites.idle) sprites['IDLE'] = char.sprites.idle;
            if (char.sprites.happy) sprites['HAPPY'] = char.sprites.happy;
            if (char.sprites.sad) sprites['SAD'] = char.sprites.sad;
            if (char.sprites.angry) sprites['ANGRY'] = char.sprites.angry;
            if (char.sprites.surprised) sprites['SURPRISED'] = char.sprites.surprised;
            if (char.sprites.shy) sprites['SHY'] = char.sprites.shy;
            if (char.sprites.thinking) sprites['THINKING'] = char.sprites.thinking;
        }
        
        updateSprite('IDLE');

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
                if (lastMsg.sender !== 'user') {
                    const { emotion, cleanText } = parseReply(lastMsg.text);
                    updateSprite(emotion);
                    typewriter(cleanText);
                } else {
                    updateSprite('IDLE');
                    typewriter(`(Kamu): ${lastMsg.text}`);
                }
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

// --- 4. MAIN CHAT LOGIC ---

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
                sessionId: currentSessionId,
                userName: currentUserName,
                userPersona: currentUserPersona
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

// --- 5. HISTORY & LOG ---
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
                
                const senderName = msg.sender === 'user' ? currentUserName : currentCharacterName;
                const { cleanText } = parseReply(msg.text);

                const nameDiv = document.createElement('div');
                nameDiv.className = 'log-sender';
                nameDiv.textContent = senderName;

                const textDiv = document.createElement('div');
                textDiv.className = 'log-text';
                textDiv.textContent = cleanText;

                const copyBtn = document.createElement('button');
                copyBtn.className = 'log-copy-btn';
                copyBtn.innerHTML = '📋';
                copyBtn.title = "Salin Teks";
                copyBtn.onclick = () => {
                    navigator.clipboard.writeText(cleanText);
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

function closeLog() { document.getElementById('log-overlay').classList.add('hidden'); }

async function deleteHistory() {
    const isSure = await showCustomConfirm(
        "Hapus Memori?", 
        "Tindakan ini akan menghapus semua percakapan di sesi ini secara permanen. Mulai ulang?"
    );

    if (!isSure) return;
    closeLog();
    document.getElementById('dialogue-text').innerText = "Menghapus ingatan...";
    
    try {
        const token = await currentUser.getIdToken();
        await fetch(`/.netlify/functions/delete-history?id=${currentCharacterId}&sessionId=${currentSessionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const storageKey = `vn_session_${currentUser.uid}_${currentCharacterId}`;
        localStorage.removeItem(storageKey);
        
        currentSessionId = generateUUID();
        localStorage.setItem(storageKey, currentSessionId);

        currentEmotion = 'IDLE';
        updateSprite('IDLE');
        
        document.getElementById('dialogue-text').innerText = "*Memori telah direset.*";
        setTimeout(() => { loadCharacterAndState(); }, 1500);

    } catch (e) {
        console.error(e);
        // UPDATE: Pakai notifikasi cantik
        showNotification("Gagal", "Error menghapus: " + e.message);
        document.getElementById('dialogue-text').innerText = "Gagal reset.";
    }
}

// --- 6. INITIALIZATION ---

async function initVN() {
    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get('id');
    if (!idFromUrl) {
        // UPDATE: Pakai notifikasi cantik (tapi perlu delay redirect biar kebaca)
        showNotification("Error", "ID Karakter tidak valid!");
        setTimeout(() => { window.location.href = 'lobby.html'; }, 2000);
        return;
    }
    currentCharacterId = idFromUrl;

    loadSettings();

    const storageKey = `vn_session_${currentUser.uid}_${currentCharacterId}`;
    let savedSession = localStorage.getItem(storageKey);

    if (!savedSession) {
        console.log("Sesi lokal kosong. Memeriksa server...");
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(`/.netlify/functions/get-sessions?characterId=${currentCharacterId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const sessions = await res.json();
                if (sessions && sessions.length > 0) {
                    sessions.sort((a, b) => {
                        const dateA = new Date(a.updatedAt._seconds ? a.updatedAt._seconds * 1000 : a.updatedAt);
                        const dateB = new Date(b.updatedAt._seconds ? b.updatedAt._seconds * 1000 : b.updatedAt);
                        return dateB - dateA; 
                    });

                    savedSession = sessions[0].id;
                    console.log("Sesi dipulihkan dari server:", savedSession);
                    localStorage.setItem(storageKey, savedSession);
                }
            }
        } catch (e) {
            console.warn("Gagal cek sesi server:", e);
        }
    }

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
    
    const btnBack = document.getElementById('btn-back');
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            window.location.href = '../index.html';
        });
    }

    const btnLog = document.getElementById('btn-log');
    if (btnLog) btnLog.addEventListener('click', openLog);
    
    const btnCloseLog = document.getElementById('close-log');
    if (btnCloseLog) btnCloseLog.addEventListener('click', closeLog);

    const btnDeleteHistory = document.getElementById('btn-delete-history');
    if (btnDeleteHistory) btnDeleteHistory.addEventListener('click', deleteHistory);

    const btnSettings = document.getElementById('btn-settings');
    const overlaySettings = document.getElementById('settings-overlay');
    const btnSaveSettings = document.getElementById('btn-save-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');

    if (btnSettings) {
        btnSettings.addEventListener('click', () => {
            loadSettings(); 
            overlaySettings.classList.remove('hidden');
        });
    }
    if (btnSaveSettings) btnSaveSettings.addEventListener('click', saveSettings);
    if (btnCloseSettings) {
        btnCloseSettings.addEventListener('click', () => {
            overlaySettings.classList.add('hidden');
        });
    }
    
    // --- EVENT LISTENER BARU UNTUK NOTIFIKASI ---
    const btnAlertOk = document.getElementById('btn-alert-ok');
    const alertModal = document.getElementById('custom-alert-modal');
    if(btnAlertOk && alertModal) {
        btnAlertOk.addEventListener('click', () => {
            alertModal.classList.add('hidden');
            alertModal.style.display = 'none';
        });
        // Opsional: Tutup jika klik area gelap
        alertModal.addEventListener('click', (e) => {
            if(e.target === alertModal) {
                alertModal.classList.add('hidden');
                alertModal.style.display = 'none';
            }
        });
    }
    // --------------------------------------------

    if (btnSend) btnSend.addEventListener('click', sendMessage);
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

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