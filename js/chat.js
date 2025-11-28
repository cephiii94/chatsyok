// File: js/chat.js (VERSI FINAL: MOBILE SUPPORT)

// === 1. GLOBAL VARIABLES ===
let currentChatbotProfile = "", currentCharacterName = "", currentCharacterGreeting = "", currentCharacterId = "1";
let currentUser = null, currentAuthToken = null, currentUserPersona = "";
let chatTranscript, chatInput, sendButton, uploadButton, fileInput, backButton, maiSprite;
let personaDisplayContainer, personaEditContainer, personaTextDisplay, editPersonaBtn, savePersonaBtn, cancelPersonaBtn, personaInput, personaStatus;

// Variabel Mobile
let profileIcon, leftPanel, mobileBackdrop, closeLeftPanelBtn, mobilePersonaTrigger, mobilePersonaPopup, closePersonaPopupBtn, mobilePersonaContentArea;

// === 2. AUTH ===
async function getAuthToken() {
    if (!currentUser) { window.location.href = 'login.html'; throw new Error("User null"); }
    try { currentAuthToken = await currentUser.getIdToken(true); return currentAuthToken; } 
    catch (error) { window.location.href = 'login.html'; throw error; }
}

// === 3. LOGIKA PERSONA ===
function togglePersonaMode(isEditing) {
    if (isEditing) {
        personaDisplayContainer.classList.add('hidden');
        personaEditContainer.classList.remove('hidden');
        personaInput.value = currentUserPersona;
        personaInput.focus();
    } else {
        personaDisplayContainer.classList.remove('hidden');
        personaEditContainer.classList.add('hidden');
        personaStatus.textContent = "";
    }
}

function updatePersonaDisplay(text) {
    if (!text || text.trim() === "") personaTextDisplay.innerHTML = '<em class="text-muted">Belum ada peran yang diatur.</em>';
    else personaTextDisplay.textContent = text;
}

async function loadUserPersona(characterId) {
    try {
        const token = await getAuthToken();
        const res = await fetch(`/.netlify/functions/manage-persona?charId=${characterId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            const data = await res.json();
            currentUserPersona = data.persona || "";
            updatePersonaDisplay(currentUserPersona);
        }
    } catch (e) { console.error("Gagal load persona:", e); }
}

async function saveUserPersona() {
    const text = personaInput.value.trim();
    savePersonaBtn.disabled = true;
    savePersonaBtn.textContent = "Menyimpan...";
    try {
        const token = await getAuthToken();
        const res = await fetch('/.netlify/functions/manage-persona', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ charId: currentCharacterId, persona: text })
        });
        if (res.ok) {
            currentUserPersona = text;
            updatePersonaDisplay(text);
            togglePersonaMode(false);
            personaStatus.textContent = "Tersimpan!";
            personaStatus.className = "status-text success";
            setTimeout(() => { personaStatus.textContent = ""; }, 2000);
            
            // Jika di mobile, tutup popup setelah simpan
            if (window.innerWidth <= 768) toggleMobilePersonaPopup(false);
        } else throw new Error("Gagal simpan");
    } catch (e) {
        personaStatus.textContent = "Gagal menyimpan.";
        personaStatus.className = "status-text error";
    } finally {
        savePersonaBtn.disabled = false;
        savePersonaBtn.textContent = "Simpan";
    }
}

// === 4. LOGIKA MOBILE UI (BARU) ===
function toggleMobileLeftPanel(show) {
    if (show) {
        leftPanel.classList.add('mobile-visible');
        mobileBackdrop.classList.add('active');
    } else {
        leftPanel.classList.remove('mobile-visible');
        mobileBackdrop.classList.remove('active');
    }
}

function toggleMobilePersonaPopup(show) {
    // Trik: Memindahkan elemen personaBox dari panel kanan ke popup mobile (dan sebaliknya)
    // Ini agar kita tidak perlu duplikat kode/elemen HTML
    const personaBox = document.querySelector('.persona-box');
    const originalParent = document.querySelector('.chat-right-panel');
    
    if (show) {
        if (personaBox && mobilePersonaContentArea) {
            mobilePersonaContentArea.appendChild(personaBox); // Pindah ke popup
            mobilePersonaPopup.classList.add('active');
            mobileBackdrop.classList.add('active'); // Gunakan backdrop yg sama
            // Tutup panel kiri biar fokus
            leftPanel.classList.remove('mobile-visible'); 
        }
    } else {
        if (personaBox && originalParent) {
            originalParent.appendChild(personaBox); // Kembalikan ke panel kanan
            mobilePersonaPopup.classList.remove('active');
            mobileBackdrop.classList.remove('active');
        }
    }
}

// === 5. LOGIKA CHAT & KARAKTER ===
async function loadCharacterProfile(characterId) {
    try {
        const res = await fetch(`/.netlify/functions/get-character?id=${characterId}`);
        if (!res.ok) throw new Error("Gagal load profile");
        const char = await res.json();
        currentChatbotProfile = char.description; currentCharacterName = char.name; currentCharacterGreeting = char.greeting;
        
        document.querySelector('.profile-info-container .profile-name').textContent = char.name;
        maiSprite = document.getElementById('mai-sprite');
        if (maiSprite) { maiSprite.src = char.image; maiSprite.classList.add('anim-idle'); }
        document.querySelector('.chat-left-panel').classList.remove('is-loading');

        if (currentUser && char.creatorId === currentUser.uid) {
            const existingBtn = document.getElementById('edit-char-btn');
            if (!existingBtn) {
                const btn = document.createElement('button');
                btn.id = 'edit-char-btn'; btn.textContent = '✏️ Edit Karakter';
                Object.assign(btn.style, { marginTop: '8px', width: '100%', padding: '8px', backgroundColor: '#ffca28', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' });
                btn.onclick = () => window.location.href = `edit-mai.html?id=${characterId}`;
                document.querySelector('.profile-info-container').appendChild(btn);
            }
        }
    } catch (e) { console.error(e); }
}

async function loadChatHistory(characterId) {
    try {
        const token = await getAuthToken();
        const res = await fetch(`/.netlify/functions/get-history?id=${characterId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return;
        const history = await res.json();
        const botBubble = document.querySelector('.chat-bubble.bot');
        if (history.length > 0 && botBubble) chatTranscript.innerHTML = '';
        history.forEach(m => addMessageToTranscript(m.text, m.sender));
        if (history.length === 0 && botBubble) botBubble.textContent = currentCharacterGreeting;
        renderHistoryList(history);
    } catch (e) { console.error(e); }
}

function renderHistoryList(historyData) {
    const container = document.getElementById('chat-history-list');
    if (!container) return;
    container.innerHTML = '';
    const msgs = historyData ? historyData.filter(m => m.sender === 'user').reverse().slice(0, 10) : [];
    if (msgs.length === 0) { container.innerHTML = '<p class="empty-state">Belum ada riwayat.</p>'; return; }
    msgs.forEach(m => {
        const d = document.createElement('div'); d.className = 'history-item';
        d.innerHTML = `<span class="date">User</span><p class="preview">${m.text}</p>`;
        container.appendChild(d);
    });
}

async function saveMessage(sender, text) {
    try {
        const token = currentAuthToken || await getAuthToken();
        await fetch('/.netlify/functions/save-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ characterId: currentCharacterId, sender, text })
        });
    } catch (e) { console.error(e); }
}

function typeText(element, text, speed = 25) {
    element.textContent = ""; element.classList.add('typing-cursor');
    let i = 0; if (maiSprite) maiSprite.classList.add('anim-idle');
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i); i++;
            if (chatTranscript) chatTranscript.scrollTop = chatTranscript.scrollHeight;
            setTimeout(type, speed + (Math.random() * 15 - 5));
        } else { element.classList.remove('typing-cursor'); }
    } type();
}

async function handleSendMessage() {
    const text = chatInput.value.trim();
    if (!text || chatInput.disabled) return;
    addMessageToTranscript(text, 'user');
    const list = document.getElementById('chat-history-list');
    if (list) {
        const empty = list.querySelector('.empty-state'); if (empty) empty.remove();
        const item = document.createElement('div'); item.className = 'history-item';
        item.innerHTML = `<span class="date">Baru Saja</span><p class="preview">${text}</p>`;
        list.firstChild ? list.insertBefore(item, list.firstChild) : list.appendChild(item);
    }
    await saveMessage('user', text);
    chatInput.value = ''; setChatInputDisabled(true);
    const typing = addMessageToTranscript("...", 'bot', 'typing');
    try {
        const token = await getAuthToken();
        const res = await fetch('/.netlify/functions/get-chat-response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ userMessage: text, characterProfile: currentChatbotProfile, characterName: currentCharacterName, characterId: currentCharacterId, userPersona: currentUserPersona })
        });
        if (!res.ok) throw new Error("Gagal server.");
        const data = await res.json();
        typing.classList.remove('typing');
        typeText(typing, data.reply);
        await saveMessage('bot', data.reply);
    } catch (e) { typing.textContent = "Maaf, ada gangguan."; typing.classList.remove('typing'); } 
    finally { setChatInputDisabled(false); chatInput.focus(); }
}

function setChatInputDisabled(d) { chatInput.disabled = d; sendButton.disabled = d; if (uploadButton) uploadButton.disabled = d; }
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file);
    });
}
function addMessageToTranscript(text, sender, extra) {
    const d = document.createElement('div'); d.classList.add('chat-bubble', sender);
    if (extra) d.classList.add(extra);
    if (text.startsWith('https://res.cloudinary.com')) {
        d.classList.add('image-bubble'); const i = document.createElement('img'); i.src = text; d.appendChild(i);
    } else { d.textContent = text; }
    chatTranscript.appendChild(d); chatTranscript.scrollTop = chatTranscript.scrollHeight; return d;
}

// === 6. INIT ===
document.addEventListener('DOMContentLoaded', async () => {
    chatTranscript = document.getElementById('chat-transcript');
    chatInput = document.getElementById('chat-input');
    sendButton = document.getElementById('send-button');
    backButton = document.getElementById('back-btn');
    uploadButton = document.getElementById('upload-btn');
    fileInput = document.getElementById('file-input');
    maiSprite = document.getElementById('mai-sprite');

    // Persona & Mobile Elements
    personaDisplayContainer = document.getElementById('persona-display-container');
    personaEditContainer = document.getElementById('persona-edit-container');
    personaTextDisplay = document.getElementById('persona-text-display');
    editPersonaBtn = document.getElementById('edit-persona-btn');
    savePersonaBtn = document.getElementById('save-persona-btn');
    cancelPersonaBtn = document.getElementById('cancel-persona-btn');
    personaInput = document.getElementById('user-persona-input');
    personaStatus = document.getElementById('persona-status');
    
    // Mobile UI Elements
    profileIcon = document.getElementById('profile-icon');
    leftPanel = document.querySelector('.chat-left-panel');
    mobileBackdrop = document.getElementById('mobile-backdrop');
    closeLeftPanelBtn = document.getElementById('close-left-panel');
    mobilePersonaTrigger = document.getElementById('mobile-persona-trigger');
    mobilePersonaPopup = document.getElementById('mobile-persona-popup');
    closePersonaPopupBtn = document.getElementById('close-persona-popup');
    mobilePersonaContentArea = document.getElementById('mobile-persona-content-area');

    if (!window.currentUser) await new Promise(resolve => document.addEventListener('authReady', resolve, { once: true }));
    currentUser = window.currentUser; if (!currentUser) return (window.location.href = 'login.html');

    const p = new URLSearchParams(window.location.search);
    currentCharacterId = p.get('id') || '1';

    loadCharacterProfile(currentCharacterId);
    loadChatHistory(currentCharacterId);
    loadUserPersona(currentCharacterId);

    // Listeners Utama
    if (sendButton) sendButton.onclick = handleSendMessage;
    if (chatInput) chatInput.onkeydown = (e) => { if (!chatInput.disabled && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } };
    if (backButton) backButton.onclick = () => window.location.href = 'index.html';
    if (uploadButton) uploadButton.onclick = () => fileInput.click();
    if (fileInput) fileInput.onchange = async (e) => { const f = fileInput.files[0]; if (f) handleFileSelected({ target: { files: [f] } }); };

    // Listeners Persona
    if (editPersonaBtn) editPersonaBtn.onclick = () => togglePersonaMode(true);
    if (cancelPersonaBtn) cancelPersonaBtn.onclick = () => togglePersonaMode(false);
    if (savePersonaBtn) savePersonaBtn.onclick = saveUserPersona;

    // Listeners Mobile UI
    if (profileIcon) profileIcon.onclick = () => toggleMobileLeftPanel(true);
    if (closeLeftPanelBtn) closeLeftPanelBtn.onclick = () => toggleMobileLeftPanel(false);
    if (mobileBackdrop) mobileBackdrop.onclick = () => {
        toggleMobileLeftPanel(false);
        toggleMobilePersonaPopup(false);
    };
    
    // Tampilkan tombol persona hanya di mobile
    if (mobilePersonaTrigger) {
        if (window.innerWidth <= 768) mobilePersonaTrigger.style.display = 'block';
        mobilePersonaTrigger.onclick = () => toggleMobilePersonaPopup(true);
    }
    if (closePersonaPopupBtn) closePersonaPopupBtn.onclick = () => toggleMobilePersonaPopup(false);
});