// vn-chat/chat.js
// VERSI: ULTIMATE FIXED (Full Feature + Auto Resume Story + Compact UI)
//

// --- 1. GLOBAL VARIABLES ---
let isVNStarted = false; // <--- TAMBAHKAN INI (GEMBOKNYA)
let currentCharacterId = "1";
let currentCharacterName = "MAI";
let currentCharacterProfile = "MAI default.";
let currentCharacter = null;
let currentUser = null; 
let currentSessionId = ''; 
let currentEmotion = 'IDLE';

// Persona & State
let currentUserName = "Teman"; 
let currentUserPersona = "";   
let isStoryMode = false; // Mode toggle

// Sprite default
const sprites = {
    'IDLE': '', 'HAPPY': '', 'SAD': '', 'ANGRY': '',
    'SURPRISED': '', 'SHY': '', 'THINKING': ''
};

// --- SETUP UI PILIHAN ---
const existingContainer = document.getElementById('choices-container');
if (existingContainer) existingContainer.remove(); 

const choicesContainer = document.createElement('div');
choicesContainer.id = 'choices-container';
document.body.appendChild(choicesContainer);

// Style Animasi
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes slideUp { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }
`;
document.head.appendChild(styleSheet);


// --- 2. HELPER FUNCTIONS ---

function generateUUID() {
    return 'vn-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Fitur: Custom Notification
function showNotification(title, message) {
    const modal = document.getElementById('custom-alert-modal');
    if (modal) {
        document.getElementById('alert-title').innerText = title || "Info";
        document.getElementById('alert-msg').innerText = message;
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    } else {
        alert(`${title}: ${message}`);
    }
}

// Fitur: Custom Confirm
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

// Fitur: Efek Mengetik
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
            // Jika Story Mode, jangan nyalakan input (karena user harus klik tombol)
            if (!isStoryMode) {
                enableInput(true);
            }
        }
    }
    type();
}

// Fitur: UI Control (Input Area)
function enableInput(enabled) {
    const input = document.getElementById('user-input');
    const btn = document.getElementById('btn-send');
    const inputArea = document.querySelector('.input-area'); 

    // Handle Tampilan Story Mode
    if (isStoryMode) {
        if(inputArea) inputArea.style.display = 'none';
        return; 
    } else {
        if(inputArea) inputArea.style.display = 'flex';
    }

    if(input) {
        input.disabled = !enabled;
        if(enabled) input.focus();
    }
    if(btn) btn.disabled = !enabled;
}

// Fitur: Ganti Sprite
function updateSprite(emotion) {
    const key = emotion ? emotion.toUpperCase() : 'IDLE';
    const validEmotion = (key in sprites) ? key : 'IDLE';
    
    let newSrc = sprites[validEmotion] || sprites['IDLE'];
    const imgEl = document.getElementById('char-sprite');

    if (imgEl) {
        imgEl.onerror = () => {
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

// Fitur: Parse Emosi
function parseReply(rawText) {
    let cleanText = rawText || "";
    let emotion = 'IDLE';
    const match = cleanText.match(/^\[([A-Z]+)\]/);
    if (match) {
        emotion = match[1];
        cleanText = cleanText.replace(match[0], '').trim();
    }
    return { emotion, cleanText };
}

// Fitur: XP Melayang
function showXPFloating(amount) {
    const el = document.createElement('div');
    el.textContent = `✨ +${amount} XP`;
    Object.assign(el.style, {
        position: 'fixed', top: '80px', right: '20px',
        background: 'rgba(255, 215, 0, 0.9)', color: '#333',
        padding: '8px 15px', borderRadius: '20px',
        fontWeight: 'bold', fontSize: '14px', zIndex: '9999',
        pointerEvents: 'none', transition: 'all 0.5s ease',
        opacity: '0', transform: 'translateY(10px)'
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-20px)';
        setTimeout(() => el.remove(), 500);
    }, 2000);
}

// --- 3. SETTINGS & CHARACTER LOADING ---

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
    showNotification("Sukses", "Pengaturan user berhasil disimpan!");
}

// [MODIFIKASI] Update fungsi load untuk handle RESUME STORY
async function loadCharacterAndState() {
    try {
        const res = await fetch(`/.netlify/functions/get-character?id=${currentCharacterId}`);
        if (!res.ok) throw new Error("Karakter tidak ditemukan");
        const char = await res.json();
        currentCharacter = char;
        
        currentCharacterProfile = char.description; 
        currentCharacterName = char.name;
        document.getElementById('char-name').textContent = char.name;

        // UI Logic
        const inputArea = document.querySelector('.input-area');
        const userInput = document.getElementById('user-input');

        if (isStoryMode) {
            console.log("🎮 MODE: STORY");
            if(inputArea) inputArea.style.display = 'none'; 
        } else {
            console.log("☕ MODE: FREE");
            if(inputArea) inputArea.style.display = 'flex';
            if(userInput) {
                userInput.disabled = false;
                userInput.placeholder = "Ketik pesan...";
            }
        }

        // Setup Sprites
        const defaultImg = char.image || "https://via.placeholder.com/400x600?text=No+Image";
        Object.keys(sprites).forEach(k => sprites[k] = defaultImg);
        if (char.sprites) {
            Object.keys(char.sprites).forEach(key => sprites[key.toUpperCase()] = char.sprites[key]);
        }
        updateSprite('IDLE');

        if (char.backgroundImage) {
            document.querySelector('.vn-background').style.backgroundImage = `url('${char.backgroundImage}')`;
        }

        // [MODIFIKASI] Logika Restore History & Auto Resume
        if (currentUser) {
            const token = await currentUser.getIdToken();
            const histRes = await fetch(`/.netlify/functions/get-history?id=${currentCharacterId}&sessionId=${currentSessionId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const history = await histRes.json();

            if (history && history.length > 0) {
                const lastMsg = history[history.length - 1];
                
                // KASUS 1: Chat terakhir adalah BOT (Kita restore tampilannya)
                if (lastMsg.sender !== 'user') {
                    let displayText = lastMsg.text;
                    let choicesToRestore = null;

                    // Cek & Parse JSON Story Mode
                    if(isStoryMode) {
                        try {
                           // Bersihkan markdown code block jika ada
                           let cleanJson = displayText.replace(/```json/gi, '').replace(/```/g, '').trim();
                           if (cleanJson.startsWith('{')) {
                               const parsed = JSON.parse(cleanJson);
                               displayText = parsed.message;
                               choicesToRestore = parsed.choices;
                           }
                        } catch(e) { console.warn("Parse Error:", e); }
                    }

                    const { emotion, cleanText } = parseReply(displayText);
                    updateSprite(emotion);
                    
                    // Pakai textContent langsung (bypass typewriter biar cepat saat loading)
                    document.getElementById('dialogue-text').textContent = cleanText;
                    
                    // Restore tombol pilihan jika ada
                    if(choicesToRestore && choicesToRestore.length > 0) {
                        showChoices(choicesToRestore);
                    } else if (!isStoryMode) {
                        enableInput(true);
                    }

                } 
                // KASUS 2: Chat terakhir adalah USER (Bot belum jawab/error sebelumnya)
                else {
                    // Tampilkan pesan user agar tidak bingung
                    document.getElementById('dialogue-text').innerText = `(Kamu): ${lastMsg.text} \n\n(Melanjutkan cerita...)`;
                    
                    // AUTO-TRIGGER: Kirim ulang pesan user ke AI untuk minta jawaban
                    console.log("🔄 Auto-resume: Memicu respons untuk pesan terakhir...");
                    
                    // Parameter 'true' di sini agar tidak save double ke DB
                    await sendMessage("...", true);
                }
            } else {
                // HISTORY KOSONG (NEW GAME)
                if (isStoryMode) {
                    console.log("🚀 Memulai cerita baru...");
                    sendMessage("[START STORY]"); 
                } else {
                    typewriter(char.greeting || `Halo! Aku ${char.name}.`);
                }
            }
        }
    } catch (e) {
        console.error("Gagal load:", e);
        document.getElementById('dialogue-text').textContent = "Gagal memuat data.";
        enableInput(true); 
    }
}

// --- 4. MAIN CHAT LOGIC ---

// [MODIFIKASI] Tambah param isResume untuk mencegah double save saat auto-trigger
async function sendMessage(manualText = null, isResume = false) {
    
    const input = document.getElementById('user-input');
    const text = manualText || input.value.trim();
    if (!text) return;

    if(input) input.value = '';
    
    enableInput(false); 
    choicesContainer.style.display = 'none';

    // Jika sedang Resume, biarkan teks lama "(Melanjutkan cerita...)"
    if (!isResume && text !== "[START STORY]") {
        document.getElementById('dialogue-text').innerText = "..."; 
    }

    try {
        if (!currentUser) throw new Error("Sesi habis, silakan refresh.");
        const token = await currentUser.getIdToken();

        // Payload ke Backend
        const payload = {
            userMessage: text,
            characterProfile: currentCharacterProfile,
            characterName: currentCharacterName,
            characterId: currentCharacterId,
            sessionId: currentSessionId,
            userName: currentUserName,
            userPersona: currentUserPersona,
            mode: isStoryMode ? 'story' : 'free',
            gameGoal: (currentCharacter && currentCharacter.gameGoal) 
                        ? currentCharacter.gameGoal 
                        : 'Jawab respons user sesuai karakter dan alur cerita.'
            };

        const res = await fetch('/.netlify/functions/get-chat-response-vn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Gagal respon server (" + res.status + ")");

        // [MODIFIKASI] Simpan pesan user (kecuali Resume atau Start Story)
        if (!isResume && text !== "[START STORY]") {
            saveMessage('user', text); 
        }

        const data = await res.json();
        console.log("Jawaban AI:", data.reply); 

        // --- HANDLE RESPONSE ---
        if (isStoryMode || data.mode === 'story') {
            handleStoryResponse(data.reply);
        } else {
            // Free Mode
            const { emotion, cleanText } = parseReply(data.reply);
            updateSprite(emotion);
            typewriter(cleanText);
            saveMessage('bot', data.reply); 
        }

    } catch (e) {
        console.error(e);
        document.getElementById('dialogue-text').innerText = "Error: " + e.message;
        if (!isStoryMode) enableInput(true); 
    }
}

//

function handleStoryResponse(jsonRaw) {
    let data;
    try {
        if (typeof jsonRaw === 'object') {
            data = jsonRaw;
        } else {
            // Bersihkan markdown JSON
            let cleanStr = jsonRaw.replace(/```json/gi, '').replace(/```/g, '').trim();
            const firstBrace = cleanStr.indexOf('{');
            const lastBrace = cleanStr.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                cleanStr = cleanStr.substring(firstBrace, lastBrace + 1);
            }
            data = JSON.parse(cleanStr);
        }
    } catch (e) {
        console.error("JSON Error:", e);
        // Fallback
        const { emotion, cleanText } = parseReply(typeof jsonRaw === 'string' ? jsonRaw : "Error data.");
        updateSprite(emotion);
        typewriter(cleanText);
        return;
    }

    // --- FITUR BARU: DYNAMIC SCENE (Update Background & Sprite) ---
    
    // 1. Ganti Background jika ada key "bg" atau "background"
    // Contoh JSON: { "message": "...", "bg": "https://link-gambar.com/taman.jpg" }
    const newBg = data.bg || data.background;
    if (newBg) {
        const bgEl = document.querySelector('.vn-background');
        // Preload image biar gak kedip
        const img = new Image();
        img.src = newBg;
        img.onload = () => {
            bgEl.style.transition = 'background-image 0.5s ease-in-out'; // Efek transisi halus
            bgEl.style.backgroundImage = `url('${newBg}')`;
        };
    }

    // 2. Ganti Sprite jika ada key "sprite" atau "image"
    // Contoh JSON: { "message": "...", "sprite": "https://link-gambar.com/mai-marah.png" }
    const newSprite = data.sprite || data.image;
    if (newSprite) {
        // Cek apakah ini URL gambar atau nama emosi (HAPPY, SAD, dll)
        if (newSprite.startsWith('http')) {
            // Kalau URL, langsung ganti gambarnya
            const imgEl = document.getElementById('char-sprite');
            imgEl.style.opacity = 0;
            setTimeout(() => {
                imgEl.src = newSprite;
                imgEl.style.opacity = 1;
            }, 200);
        } else {
            // Kalau cuma nama emosi (misal: "ANGRY"), panggil fungsi updateSprite biasa
            updateSprite(newSprite);
        }
    } else {
        // Jika tidak ada request sprite khusus, cek dari teks emosi [HAPPY]
        const { emotion } = parseReply(data.message);
        updateSprite(emotion);
    }
    // -----------------------------------------------------------

    // 3. Tampilkan Teks (Bersihkan tag emosi dulu)
    const { cleanText } = parseReply(data.message);
    typewriter(cleanText);

    // 4. Simpan Full JSON ke History
    saveMessage('bot', JSON.stringify(data));

    // 5. Tampilkan Pilihan
    const delay = Math.min(cleanText.length * 20 + 500, 3000);
    
    if (data.choices && data.choices.length > 0) {
        setTimeout(() => showChoices(data.choices), delay);
    } else {
        setTimeout(() => enableInput(true), delay);
    }
}

// --- FUNGSI TAMPILAN PILIHAN ---
function showChoices(choices) {
    choicesContainer.innerHTML = '';
    choicesContainer.style.display = 'flex'; 
    
    choices.forEach((choice, index) => {
        const btn = document.createElement('button');
        btn.textContent = choice.text;
        
        btn.classList.add('choice-btn');
        if (choice.type === 'good') btn.classList.add('type-good');
        if (choice.type === 'bad') btn.classList.add('type-bad');

        btn.style.animationDelay = `${index * 0.1}s`;

        btn.onclick = () => {
            choicesContainer.style.display = 'none'; 
            sendMessage(choice.text); // Kirim jawaban
        };
        
        choicesContainer.appendChild(btn);
    });
}

// --- 5. LEVELING & SAVE ---

async function saveMessage(sender, text) {
    try {
        if(!currentUser) return;
        const token = await currentUser.getIdToken();
        const res = await fetch('/.netlify/functions/save-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ characterId: currentCharacterId, sender, text, sessionId: currentSessionId })
        });

        if (res.ok) {
            const data = await res.json();
            // Fitur XP & Level Up
            if (sender === 'user' && data.xpAdded) showXPFloating(data.xpAdded);
            if (data.levelUp && data.newLevel) showLevelUpVN(data.newLevel);
            else if (data.newBadges && data.newBadges.length > 0) showBadgeVN(data.newBadges[0]);
        }
    } catch (e) { console.error("Gagal simpan:", e); }
}

function showLevelUpVN(newLevel) {
    const modal = document.getElementById('level-up-overlay');
    const box = modal.querySelector('.level-up-box');

    if (box.dataset.type === 'badge') {
        box.innerHTML = `
            <div class="level-stars">⭐⭐⭐</div>
            <h1 class="level-title">LEVEL UP!</h1>
            <div class="level-number-container">
                <span class="level-label">LEVEL</span>
                <span id="new-level-display">${newLevel}</span>
            </div>
            <p class="level-msg">Hebat! Kamu semakin sepuh!</p>
            <button id="btn-close-level" class="level-btn">Lanjut Cerita ▶️</button>
        `;
        document.getElementById('btn-close-level').onclick = () => closeModalVN(modal);
        box.dataset.type = 'level';
    } else {
        const levelDisplay = document.getElementById('new-level-display');
        if (levelDisplay) levelDisplay.textContent = newLevel;
    }

    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('active'), 10);
        const btn = document.getElementById('btn-close-level');
        if (btn) btn.onclick = () => closeModalVN(modal);
    }
}

function showBadgeVN(badge) {
    const modal = document.getElementById('level-up-overlay');
    const box = modal.querySelector('.level-up-box');

    if (modal && box) {
        box.dataset.type = 'badge';
        box.innerHTML = `
            <div class="level-stars" style="font-size: 50px;">${badge.icon}</div>
            <h1 class="level-title" style="color: #00bcd4; text-shadow: 2px 2px 0 #005662;">LENCANA BARU!</h1>
            <div class="level-number-container" style="background: rgba(0, 188, 212, 0.2);">
                <span class="level-label" style="color: #e0f7fa;">DIBUKA</span>
                <span style="display:block; font-size: 24px; font-weight:bold; color:white; margin-top:5px;">
                    ${badge.name}
                </span>
            </div>
            <p class="level-msg">Keren! Koleksi lencanamu bertambah.</p>
            <button id="btn-close-badge-vn" class="level-btn" style="background: #00bcd4; color: white;">Lanjut ▶️</button>
        `;

        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('active'), 10);
        document.getElementById('btn-close-badge-vn').onclick = () => closeModalVN(modal);
    }
}

function closeModalVN(modal) {
    modal.classList.remove('active');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

// --- 6. HISTORY & LOG UTILS ---

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
                
                let displayText = msg.text;
                try {
                     // Jika JSON Story, ambil pesannya saja buat log
                     if(displayText.trim().startsWith('{')) {
                        displayText = JSON.parse(displayText).message;
                     }
                } catch(e){}

                const { cleanText } = parseReply(displayText);

                const nameDiv = document.createElement('div');
                nameDiv.className = 'log-sender';
                nameDiv.textContent = senderName;

                const textDiv = document.createElement('div');
                textDiv.className = 'log-text';
                textDiv.textContent = cleanText;

                item.appendChild(nameDiv);
                item.appendChild(textDiv);
                logContent.appendChild(item);
            });
            logContent.scrollTop = logContent.scrollHeight;
        }
    } catch (e) {
        logContent.innerHTML = '<p style="text-align:center; color:#ff6b6b;">Gagal memuat riwayat.</p>';
    }
}

function closeLog() { 
    const logOverlay = document.getElementById('log-overlay');
    if(logOverlay) logOverlay.classList.add('hidden'); 
}

async function deleteHistory() {
    const isSure = await showCustomConfirm("Hapus Memori?", "Reset cerita ini?");
    if (!isSure) return;
    closeLog();
    
    try {
        const token = await currentUser.getIdToken();
        await fetch(`/.netlify/functions/delete-history?id=${currentCharacterId}&sessionId=${currentSessionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // Reset Session Key
        const sessionKey = `vn_session_${currentUser.uid}_${currentCharacterId}_${isStoryMode ? 'story' : 'free'}`;
        localStorage.removeItem(sessionKey);
        
        currentSessionId = generateUUID();
        localStorage.setItem(sessionKey, currentSessionId);

        currentEmotion = 'IDLE';
        updateSprite('IDLE');
        document.getElementById('dialogue-text').innerText = "*Memori direset.*";
        
        // Reload State
        setTimeout(() => { loadCharacterAndState(); }, 1000);

    } catch (e) {
        showNotification("Gagal", e.message);
    }
}

// --- 7. INITIALIZATION ---

async function initVN() {
    // [MODIFIKASI] Cek apakah VN sudah berjalan? Kalau sudah, berhenti.
    if (isVNStarted) return; 
    isVNStarted = true; // Kunci gemboknya!

    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get('id');
    const modeFromUrl = params.get('mode'); // 'free' atau 'story'

    if (!idFromUrl) {
        showNotification("Error", "ID Karakter tidak valid!");
        setTimeout(() => { window.location.href = '../index.html'; }, 2000);
        return;
    }
    currentCharacterId = idFromUrl;

    // 1. SET MODE
    isStoryMode = (modeFromUrl === 'story');

    loadSettings();

    // 2. SETUP SESSION KEY (Beda mode, beda sesi)
    const sessionKey = `vn_session_${currentUser.uid}_${currentCharacterId}_${isStoryMode ? 'story' : 'free'}`;
    let savedSession = localStorage.getItem(sessionKey);

    // 3. RESTORE SESSION
    if (!savedSession) {
        console.log("Sesi lokal kosong. Generate baru...");
        currentSessionId = generateUUID();
        localStorage.setItem(sessionKey, currentSessionId);
    } else {
        currentSessionId = savedSession;
    }

    loadCharacterAndState();
}

// --- 8. EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    // Tombol standar
    const btnSend = document.getElementById('btn-send');
    const input = document.getElementById('user-input');
    const btnBack = document.getElementById('btn-back');
    const btnMenu = document.getElementById('btn-menu-trigger');
    const menuDropdown = document.getElementById('vn-system-menu');
    
    if(btnBack) btnBack.addEventListener('click', () => window.location.href = 'lobby.html');
    if(btnSend) btnSend.addEventListener('click', () => sendMessage());
    if(input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });

    // Menu System
    if (btnMenu && menuDropdown) {
        btnMenu.addEventListener('click', (e) => {
            e.stopPropagation(); 
            menuDropdown.classList.toggle('hidden');
            btnMenu.classList.toggle('active');
        });
    }

    document.addEventListener('click', (e) => {
        if (menuDropdown && !menuDropdown.classList.contains('hidden')) {
            if (!menuDropdown.contains(e.target) && e.target !== btnMenu) {
                menuDropdown.classList.add('hidden');
                btnMenu.classList.remove('active');
            }
        }
    });

    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            if(menuDropdown) menuDropdown.classList.add('hidden');
            if(btnMenu) btnMenu.classList.remove('active');
        });
    });

    // Settings
    document.getElementById('btn-settings').addEventListener('click', () => {
        loadSettings(); document.getElementById('settings-overlay').classList.remove('hidden');
    });
    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
    document.getElementById('btn-close-settings').addEventListener('click', () => {
        document.getElementById('settings-overlay').classList.add('hidden');
    });

    // Log & History
    document.getElementById('btn-log').addEventListener('click', openLog);
    document.getElementById('close-log').addEventListener('click', closeLog);
    document.getElementById('btn-delete-history').addEventListener('click', deleteHistory);

    // Alert
    const btnAlertOk = document.getElementById('btn-alert-ok');
    const alertModal = document.getElementById('custom-alert-modal');
    if(btnAlertOk && alertModal) {
        btnAlertOk.addEventListener('click', () => {
            alertModal.classList.add('hidden');
            alertModal.style.display = 'none';
        });
    }

    // Init Auth
    if (typeof firebase !== 'undefined') {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) { currentUser = user; initVN(); }
            else { window.location.href = '../login.html'; }
        });
    }
});