// File: js/chat.js (FINAL: Toast & Copy for User)

// === 1. GLOBAL VARIABLES ===
let currentChatbotProfile = "", currentCharacterName = "", currentCharacterGreeting = "", currentCharacterId = "1";
let currentUser = null, currentAuthToken = null, currentUserPersona = "";
let chatTranscript, chatInput, sendButton, uploadButton, fileInput, backButton, maiSprite;
let personaDisplayContainer, personaEditContainer, personaTextDisplay, editPersonaBtn, savePersonaBtn, cancelPersonaBtn, personaInput, personaStatus;
let isUserNearBottom = true; 
let profileIcon, leftPanel, mobileBackdrop, closeLeftPanelBtn, mobilePersonaTrigger, mobilePersonaPopup, closePersonaPopupBtn, mobilePersonaContentArea;
let attachmentPreview, previewImg, btnCancelAttach;
let currentSelectedFile = null;
let lastUserMessage = ""; 
let imageViewerModal, fullImage, closeViewerBtn;

const DEFAULT_AVATAR = "https://ui-avatars.com/api/?name=AI&background=random&color=fff&size=256";

// === 2. HELPER FUNCTIONS ===

async function getAuthToken() {
    if (!currentUser) { 
        if (window.currentUser) currentUser = window.currentUser;
        else return null; 
    }
    return await currentUser.getIdToken(true);
}

function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function showCustomConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        if (!modal) { resolve(confirm(message)); return; }
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-msg').textContent = message;
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('visible'), 10);
        
        const close = (res) => {
            modal.classList.remove('visible');
            setTimeout(() => modal.style.display = 'none', 300);
            resolve(res);
        };
        document.getElementById('btn-confirm-yes').onclick = () => close(true);
        document.getElementById('btn-confirm-cancel').onclick = () => close(false);
    });
}

// --- TOAST NOTIFICATION ---
function showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.classList.remove('hidden');
        // Reset timer jika dipanggil berulang
        if (toast.timeoutId) clearTimeout(toast.timeoutId);
        toast.timeoutId = setTimeout(() => {
            toast.classList.add('hidden');
        }, 2000); // Hilang dalam 2 detik
    } else {
        alert(message); // Fallback
    }
}

// === 3. CORE LOGIC ===

async function loadCharacterProfile(characterId) {
    const nameEl = document.querySelector('.profile-info-container .profile-name');
    const spriteEl = document.getElementById('mai-sprite');
    
    try {
        const res = await fetch(`/.netlify/functions/get-character?id=${characterId}`);
        if (!res.ok) throw new Error("Karakter tidak ditemukan");
        
        const char = await res.json();
        currentChatbotProfile = char.description; 
        currentCharacterName = char.name; 
        currentCharacterGreeting = char.greeting;
        
        if (nameEl) nameEl.textContent = char.name;
        if (spriteEl) {
            spriteEl.onload = () => spriteEl.classList.add('anim-idle');
            spriteEl.onerror = () => { spriteEl.src = DEFAULT_AVATAR; };
            spriteEl.src = char.image || DEFAULT_AVATAR;
        }

        // Edit button logic (same as before)
        if (currentUser && (char.creatorId === currentUser.uid || (await currentUser.getIdTokenResult()).claims.admin)) {
            renderEditButton(characterId);
        }
    } catch (e) { 
        console.error(e);
        if (nameEl) { nameEl.textContent = "Error Memuat Data"; nameEl.style.color = "red"; }
        if (spriteEl) spriteEl.src = DEFAULT_AVATAR;
    }
}

function renderEditButton(charId) {
    const container = document.querySelector('.profile-info-container');
    if (!container || document.getElementById('edit-char-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'edit-char-btn'; btn.textContent = '✏️ Edit Karakter';
    Object.assign(btn.style, { marginTop: '8px', width: '100%', padding: '8px', backgroundColor: '#e0e0e0', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#333' });
    btn.onclick = () => window.location.href = `edit-mai.html?id=${charId}`;
    container.appendChild(btn);
}

async function loadChatHistory(characterId) {
    try {
        const token = await getAuthToken();
        if (!token) return; 
        const res = await fetch(`/.netlify/functions/get-history?id=${characterId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return;
        
        const history = await res.json();
        chatTranscript.innerHTML = '';
        
        if (history.length === 0) {
            addMessageToTranscript(currentCharacterGreeting || "Halo! Ada yang bisa saya bantu?", 'bot');
        } else {
            history.forEach(m => addMessageToTranscript(m.text, m.sender, true));
        }
        renderHistoryList(history);
        scrollToBottom();
    } catch (e) { console.error(e); }
}

async function triggerAI(messageContent) {
    showTypingIndicator();
    
    try {
        const token = await getAuthToken();
        const now = new Date();
        const localTime = now.toLocaleString('id-ID', { 
            weekday: 'long', year: 'numeric', month: 'long', 
            day: 'numeric', hour: '2-digit', minute: '2-digit',
            timeZoneName: 'short' 
        });

        const res = await fetch('/.netlify/functions/get-chat-response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                userMessage: messageContent, 
                characterProfile: currentChatbotProfile, 
                characterName: currentCharacterName, 
                characterId: currentCharacterId, 
                userPersona: currentUserPersona,
                userLocalTime: localTime 
            })
        });
        
        removeTypingIndicator();

        if (!res.ok) throw new Error("Gagal server.");
        const data = await res.json();
        
        addMessageToTranscript(data.reply, 'bot');
        await saveMessage('bot', data.reply);
    } catch (e) {
        removeTypingIndicator();
        addMessageToTranscript("Maaf, koneksi terputus.", 'bot');
    }
}

// === 4. CHAT UI LOGIC ===

function addMessageToTranscript(text, sender, isHistory = false) {
    const container = document.createElement('div');
    container.className = `chat-bubble-container ${sender}`;
    
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;

    const isCloudinary = text && text.startsWith('https://res.cloudinary.com');
    const isBase64 = text && text.startsWith('data:image');
    
    // KONTEN
    if (isCloudinary || isBase64) {
        bubble.classList.add('image-bubble'); 
        const img = document.createElement('img'); 
        img.src = text; 
        img.onclick = () => openImageViewer(text); 
        img.style.cursor = 'zoom-in';
        bubble.appendChild(img);
    } 
    else if (text && text.toLowerCase().endsWith('.pdf')) {
        bubble.classList.add('file-bubble'); 
        bubble.innerHTML = `<div style="display:flex; align-items:center; gap:10px;"><span style="font-size:24px;">📄</span><a href="${text}" target="_blank" style="color:inherit; text-decoration:underline;">Dokumen PDF</a></div>`;
    } 
    else {
        if (sender === 'bot' && typeof marked !== 'undefined') {
            bubble.innerHTML = marked.parse(text); 
        } else {
            bubble.textContent = text; 
        }
    }

    // TIMESTAMP
    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-time';
    timeSpan.textContent = getCurrentTime();
    bubble.appendChild(timeSpan);

    container.appendChild(bubble);

    // ▼▼▼ ACTION BUTTONS (COPY UNTUK SEMUA, REGEN UNTUK BOT) ▼▼▼
    if (!isCloudinary) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        
        // Tombol Salin (Copy) - Muncul untuk User & Bot
        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-icon-btn';
        copyBtn.innerHTML = '📋';
        copyBtn.title = "Salin Teks";
        copyBtn.onclick = () => { 
            navigator.clipboard.writeText(text); 
            showToast('Teks disalin!'); // Gunakan Toast baru
        };
        actionsDiv.appendChild(copyBtn);

        // Tombol Regenerate - Hanya untuk Bot
        if (sender === 'bot') {
            const regenBtn = document.createElement('button');
            regenBtn.className = 'action-icon-btn';
            regenBtn.innerHTML = '🔄';
            regenBtn.title = "Jawab Ulang";
            regenBtn.onclick = () => regenerateLastMessage(container);
            actionsDiv.appendChild(regenBtn);
        }

        container.appendChild(actionsDiv);
    }
    // ▲▲▲

    chatTranscript.appendChild(container);

    if (sender === 'user' || isUserNearBottom || !isHistory) {
        scrollToBottom();
    }
}

// --- COMMON FUNCTIONS ---
function scrollToBottom() { chatTranscript.scrollTop = chatTranscript.scrollHeight; }
function handleScroll() {
    const threshold = 100; 
    const position = chatTranscript.scrollTop + chatTranscript.offsetHeight;
    isUserNearBottom = position >= chatTranscript.scrollHeight - threshold;
}
function showTypingIndicator() {
    const container = document.createElement('div');
    container.id = 'typing-indicator-bubble';
    container.className = 'chat-bubble-container bot'; 
    container.innerHTML = `<div class="chat-bubble bot"><div class="typing-indicator" style="margin:0; padding:0; background:none; box-shadow:none;"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
    chatTranscript.appendChild(container);
    scrollToBottom();
}
function removeTypingIndicator() { const el = document.getElementById('typing-indicator-bubble'); if(el) el.remove(); }
async function saveMessage(sender, text) {
    try {
        const token = await getAuthToken();
        await fetch('/.netlify/functions/save-message', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ characterId: currentCharacterId, sender, text })
        });
    } catch (e) { console.error(e); }
}
async function regenerateLastMessage(bubbleContainer) {
    if (!lastUserMessage) return;
    bubbleContainer.remove();
    await triggerAI(lastUserMessage);
}
async function handleSendMessage() {
    const text = chatInput.value.trim();
    if ((!text && !currentSelectedFile) || chatInput.disabled) return;
    chatInput.value = ''; chatInput.style.height = '50px';
    setChatInputDisabled(true);

    if (currentSelectedFile) await handleFileUpload(currentSelectedFile, text);
    else {
        addMessageToTranscript(text, 'user');
        lastUserMessage = text;
        await saveMessage('user', text);
        await triggerAI(text);
    }
    setChatInputDisabled(false); chatInput.focus();
}
async function handleFileUpload(file, caption) {
    try {
        const base64 = await readFileAsBase64(file);
        addMessageToTranscript(previewImg.src, 'user');
        cancelAttachment();
        
        const token = await getAuthToken();
        const res = await fetch('/.netlify/functions/upload-image', { 
            method: 'POST', headers: {'Content-Type':'application/json', 'Authorization': `Bearer ${token}`},
            body: JSON.stringify({file: base64})
        });
        if(!res.ok) throw new Error("Gagal upload");
        
        const data = await res.json();
        await saveMessage('user', data.secure_url);
        
        // Simpan URL gambar sebagai "pesan terakhir" agar kalau diregenerate, AI tetap baca gambarnya
        lastUserMessage = data.secure_url; 

        if(caption) { 
            addMessageToTranscript(caption, 'user'); 
            await saveMessage('user', caption); 
            lastUserMessage = caption; // Jika ada caption, update pesan terakhir jadi caption
        }
        
        await triggerAI(data.secure_url);
    } catch(e) { console.error(e); addMessageToTranscript("Gagal mengirim file.", 'bot'); }
}
function setChatInputDisabled(d) { chatInput.disabled = d; sendButton.disabled = d; if(uploadButton) uploadButton.disabled = d; }
function cancelAttachment() { currentSelectedFile = null; fileInput.value = ''; attachmentPreview.classList.add('hidden'); }
function readFileAsBase64(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); }
function openImageViewer(src) { const m=document.getElementById('image-viewer-modal'); const i=document.getElementById('full-image'); if(m&&i){ i.src=src; m.classList.add('active'); }}
function renderHistoryList(history) {
    const el = document.getElementById('chat-history-list'); if(!el) return;
    el.innerHTML = '';
    const items = history.filter(m=>m.sender==='user').reverse().slice(0,10);
    if(items.length===0) el.innerHTML='<p class="empty-state">Belum ada riwayat.</p>';
    items.forEach(m=>{
        const d=document.createElement('div'); d.className='history-item';
        d.innerHTML=`<span class="date">User</span><p class="preview">${m.text}</p>`;
        el.appendChild(d);
    });
}
async function loadUserPersona(id) {
    try {
        const token = await getAuthToken();
        const res = await fetch(`/.netlify/functions/manage-persona?charId=${id}`, {headers:{'Authorization':`Bearer ${token}`}});
        if(res.ok) {
            const d=await res.json(); currentUserPersona=d.persona||"";
            if(personaTextDisplay) personaTextDisplay.textContent=currentUserPersona||"Belum ada peran.";
        }
    } catch(e) { console.log(e); }
}
async function saveUserPersona() {
    const text = personaInput.value.trim();
    savePersonaBtn.textContent="Simpan...";
    try {
        const token = await getAuthToken();
        await fetch('/.netlify/functions/manage-persona', {
            method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
            body:JSON.stringify({charId:currentCharacterId, persona:text})
        });
        currentUserPersona=text;
        if(personaTextDisplay) personaTextDisplay.textContent=text;
        personaEditContainer.classList.add('hidden');
        personaDisplayContainer.classList.remove('hidden');
    } catch(e){ showToast('Gagal simpan peran'); }
    savePersonaBtn.textContent="Simpan";
}

// === 5. INIT ===
document.addEventListener('DOMContentLoaded', async () => {
    chatTranscript = document.getElementById('chat-transcript');
    chatInput = document.getElementById('chat-input');
    sendButton = document.getElementById('send-button');
    uploadButton = document.getElementById('upload-btn');
    fileInput = document.getElementById('file-input');
    backButton = document.getElementById('back-btn');
    maiSprite = document.getElementById('mai-sprite');
    attachmentPreview = document.getElementById('attachment-preview');
    previewImg = document.getElementById('preview-img');
    btnCancelAttach = document.getElementById('btn-cancel-attach');
    personaDisplayContainer = document.getElementById('persona-display-container');
    personaEditContainer = document.getElementById('persona-edit-container');
    personaTextDisplay = document.getElementById('persona-text-display');
    editPersonaBtn = document.getElementById('edit-persona-btn');
    savePersonaBtn = document.getElementById('save-persona-btn');
    cancelPersonaBtn = document.getElementById('cancel-persona-btn');
    personaInput = document.getElementById('user-persona-input');
    imageViewerModal = document.getElementById('image-viewer-modal');
    fullImage = document.getElementById('full-image');

    const closeV = document.querySelector('.close-viewer');
    if(closeV) closeV.onclick = () => imageViewerModal.classList.remove('active');

    if(chatTranscript) chatTranscript.addEventListener('scroll', handleScroll);

    if (!window.currentUser) await new Promise(resolve => document.addEventListener('authReady', resolve, { once: true }));
    currentUser = window.currentUser; if (!currentUser) return (window.location.href = 'login.html');

    const p = new URLSearchParams(window.location.search);
    currentCharacterId = p.get('id') || '1';

    loadCharacterProfile(currentCharacterId);
    loadChatHistory(currentCharacterId);
    loadUserPersona(currentCharacterId);

    if(sendButton) sendButton.onclick = handleSendMessage;
    if(chatInput) chatInput.onkeydown = (e) => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }};
    if(uploadButton) uploadButton.onclick = () => fileInput.click();
    if(fileInput) fileInput.onchange = (e) => {
        const f = e.target.files[0]; if(!f) return; currentSelectedFile=f;
        previewImg.src = f.type.startsWith('image/') ? URL.createObjectURL(f) : "https://cdn-icons-png.flaticon.com/512/337/337946.png";
        attachmentPreview.classList.remove('hidden'); chatInput.focus();
    };
    if(btnCancelAttach) btnCancelAttach.onclick = cancelAttachment;
    if(backButton) backButton.onclick = () => window.location.href='index.html';
    
    if(editPersonaBtn) editPersonaBtn.onclick = () => { personaDisplayContainer.classList.add('hidden'); personaEditContainer.classList.remove('hidden'); personaInput.value=currentUserPersona; };
    if(cancelPersonaBtn) cancelPersonaBtn.onclick = () => { personaDisplayContainer.classList.remove('hidden'); personaEditContainer.classList.add('hidden'); };
    if(savePersonaBtn) savePersonaBtn.onclick = saveUserPersona;
    
    const menuBtn = document.getElementById('menu-btn');
    const dropdown = document.getElementById('chat-dropdown');
    if(menuBtn) menuBtn.onclick = (e) => { e.stopPropagation(); dropdown.classList.toggle('show'); };
    window.onclick = () => { if(dropdown) dropdown.classList.remove('show'); };
    
    const delBtn = document.getElementById('delete-chat-item');
    if(delBtn) delBtn.onclick = async () => {
        const sure = await showCustomConfirm('Hapus Chat?', 'Riwayat obrolan akan dihapus permanen.');
        if(sure) {
            const t = await getAuthToken();
            await fetch(`/.netlify/functions/delete-history?id=${currentCharacterId}`, {method:'DELETE', headers:{'Authorization':`Bearer ${t}`}});
            location.reload();
        }
    };
    
    const pIcon = document.getElementById('profile-icon');
    const lPanel = document.querySelector('.chat-left-panel');
    const mBack = document.getElementById('mobile-backdrop');
    if(pIcon) pIcon.onclick = () => { lPanel.classList.add('mobile-visible'); mBack.classList.add('active'); };
    const closeLP = document.getElementById('close-left-panel');
    if(closeLP) closeLP.onclick = () => { lPanel.classList.remove('mobile-visible'); mBack.classList.remove('active'); };
    if(mBack) mBack.onclick = () => { lPanel.classList.remove('mobile-visible'); mBack.classList.remove('active'); };
    
    const mobilePersonaTrig = document.getElementById('mobile-persona-trigger');
    const mobilePersonaPop = document.getElementById('mobile-persona-popup');
    const mobilePersonaContent = document.getElementById('mobile-persona-content-area');
    const personaBox = document.querySelector('.persona-box');
    const desktopRightPanel = document.querySelector('.chat-right-panel');
    const closePersonaPopBtn = document.getElementById('close-persona-popup');

    if(mobilePersonaTrig) {
        mobilePersonaTrig.onclick = () => {
            if(personaBox && mobilePersonaContent) {
                mobilePersonaContent.appendChild(personaBox);
                mobilePersonaPop.classList.add('active');
                mBack.classList.add('active');
                lPanel.classList.remove('mobile-visible'); 
            }
        };
    }
    if(closePersonaPopBtn) {
        closePersonaPopBtn.onclick = () => {
            mobilePersonaPop.classList.remove('active');
            mBack.classList.remove('active');
            if(personaBox && desktopRightPanel) desktopRightPanel.appendChild(personaBox);
        };
    }
});