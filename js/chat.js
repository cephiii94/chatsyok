// File: js/chat.js
// Versi: Final Release (Manual Save, Edit Title, Reset Chat)

// === 1. GLOBAL VARIABLES ===
let currentChatbotProfile = "", currentCharacterName = "", currentCharacterGreeting = "", currentCharacterId = "1";
let currentUser = null, currentUserPersona = "";
let currentSessionId = null; // ID Sesi yang sedang aktif
let editingSessionId = null; // ID Sesi yang sedang diedit judulnya

// Elemen UI
let chatTranscript, chatInput, sendButton, uploadButton, fileInput, backButton, maiSprite;
let personaDisplayContainer, personaEditContainer, personaTextDisplay, editPersonaBtn, savePersonaBtn, cancelPersonaBtn, personaInput;
let imageViewerModal, fullImage;
let isUserNearBottom = true; 
let currentSelectedFile = null;
let lastUserMessage = ""; 

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

function showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.classList.remove('hidden');
        if (toast.timeoutId) clearTimeout(toast.timeoutId);
        toast.timeoutId = setTimeout(() => {
            toast.classList.add('hidden');
        }, 2000); 
    } else {
        alert(message); 
    }
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
        
        const yesBtn = document.getElementById('btn-confirm-yes');
        const noBtn = document.getElementById('btn-confirm-cancel');
        const newYes = yesBtn.cloneNode(true);
        const newNo = noBtn.cloneNode(true);
        yesBtn.parentNode.replaceChild(newYes, yesBtn);
        noBtn.parentNode.replaceChild(newNo, noBtn);

        newYes.onclick = () => close(true);
        newNo.onclick = () => close(false);
    });
}

function generateUUID() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'sess-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function extractNameFromPersona(text) {
    if (!text) return null;
    const regex = /(?:nama saya|namaku|nama aku|panggil saya|panggil aku|my name is|call me)\s+([a-zA-Z0-9 ]{1,25})/i;
    const match = text.match(regex);
    if (match && match[1]) {
        return match[1].split(/[.,!;\n]/)[0].trim();
    }
    return null;
}

// === 3. CORE LOGIC ===

async function initChat() {
    await loadCharacterProfile(currentCharacterId);
    await loadSessionsList(); 
    await loadUserPersona(currentCharacterId);

    // Jika belum ada sesi (pertama kali load), buat sesi draft baru
    if (!currentSessionId) {
        startNewSession(false); 
    } else {
        loadChatHistory(currentSessionId);
    }
}

async function loadCharacterProfile(characterId) {
    try {
        const res = await fetch(`/.netlify/functions/get-character?id=${characterId}`);
        if (!res.ok) throw new Error("Karakter tidak ditemukan");
        
        const char = await res.json();
        currentChatbotProfile = char.description; 
        currentCharacterName = char.name; 
        currentCharacterGreeting = char.greeting;
        
        const profileName = document.querySelector('.profile-info-container .profile-name');
        const headerName = document.getElementById('header-char-name');
        if (profileName) profileName.textContent = char.name;
        if (headerName) headerName.textContent = char.name;
        
        const spriteEl = document.getElementById('mai-sprite');
        const headerAvatar = document.getElementById('header-char-avatar');
        const imgUrl = char.image || DEFAULT_AVATAR;
        
        if (spriteEl) spriteEl.src = imgUrl;
        if (headerAvatar) { headerAvatar.src = imgUrl; headerAvatar.style.display = 'block'; }

    } catch (e) { console.error(e); }
}

// --- SESSION & HISTORY MANAGEMENT ---

async function loadSessionsList() {
    const listEl = document.getElementById('chat-history-list');
    if (!listEl) return;

    try {
        const token = await getAuthToken();
        const res = await fetch(`/.netlify/functions/get-sessions?charId=${currentCharacterId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) return;
        const sessions = await res.json();
        
        listEl.innerHTML = ''; 

        if (sessions.length === 0) {
            listEl.innerHTML = '<p class="empty-state" style="font-size:0.8rem; padding: 10px;">Belum ada sesi tersimpan.</p>';
        } else {
            // Jika belum ada sesi aktif saat init, pilih yang terbaru dari list
            if (!currentSessionId && sessions.length > 0) {
               currentSessionId = sessions[0].id;
            }

            sessions.forEach(session => {
                const item = document.createElement('div');
                item.className = `history-item ${session.id === currentSessionId ? 'active' : ''}`;
                
                let dateDisplay = "";
                if(session.updatedAt) {
                    const d = new Date(session.updatedAt); 
                    dateDisplay = d.toLocaleDateString('id-ID', {day:'numeric', month:'short'});
                }

                item.style.display = 'flex';
                item.style.justifyContent = 'space-between';
                item.style.alignItems = 'center';

                item.innerHTML = `
                    <div style="flex-grow: 1; overflow: hidden; margin-right: 8px;">
                        <span class="date">${dateDisplay}</span>
                        <p class="preview" style="font-weight:500;">${session.preview}</p>
                    </div>
                    <div class="session-actions">
                        <button class="session-btn edit-session-btn" title="Ubah Judul">✏️</button>
                        <button class="session-btn delete-session-btn" title="Hapus Sesi">🗑️</button>
                    </div>
                `;
                
                // 1. Pindah Sesi
                item.onclick = (e) => {
                    if (e.target.closest('.session-btn')) return;
                    switchSession(session.id);
                };

                // 2. Edit Judul
                const editBtn = item.querySelector('.edit-session-btn');
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    openEditModal(session.id, session.preview);
                };

                // 3. Hapus Sesi
                const delBtn = item.querySelector('.delete-session-btn');
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                };

                listEl.appendChild(item);
            });
        }
    } catch(e) { console.error("Gagal load sesi:", e); }
}

function startNewSession(refreshList = true) {
    currentSessionId = generateUUID(); 
    chatTranscript.innerHTML = ''; 
    addMessageToTranscript(currentCharacterGreeting || "Halo!", 'bot'); 
    
    if (refreshList) {
        loadSessionsList(); 
        closeMobileSidebar();
    }
}

function switchSession(sessionId) {
    if (currentSessionId === sessionId) return;
    currentSessionId = sessionId;
    loadChatHistory(sessionId);
    loadSessionsList(); // Update highlight
    closeMobileSidebar();
}

// --- MODAL & SAVE LOGIC ---

function openEditModal(sessionId, currentTitle) {
    editingSessionId = sessionId;
    const modal = document.getElementById('save-session-modal');
    const input = document.getElementById('session-title-input');
    const titleEl = modal.querySelector('h3');
    if(modal) {
        if(input) input.value = currentTitle || ''; 
        if(titleEl) titleEl.textContent = "Ubah Judul Sesi";
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('visible'), 10);
        if(input) input.focus();
    }
}

function openSaveModal() {
    editingSessionId = null;
    const modal = document.getElementById('save-session-modal');
    const input = document.getElementById('session-title-input');
    const titleEl = modal.querySelector('h3');
    if(modal) {
        if(input) input.value = ''; 
        if(titleEl) titleEl.textContent = "Simpan Percakapan";
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('visible'), 10);
        if(input) input.focus();
    }
}

function closeSaveModal() {
    const modal = document.getElementById('save-session-modal');
    if(modal) {
        modal.classList.remove('visible');
        setTimeout(() => modal.style.display = 'none', 300);
    }
    editingSessionId = null;
}

function saveCurrentSession() {
    if (!currentSessionId) { showToast("Tidak ada sesi aktif."); return; }
    openSaveModal();
}

async function handleSaveConfirm() {
    const titleInput = document.getElementById('session-title-input');
    const title = titleInput.value.trim();
    if (!title) { alert("Judul tidak boleh kosong!"); return; }
    
    const targetId = editingSessionId || currentSessionId;
    if (!targetId) return;

    closeSaveModal();
    
    try {
        showToast("Menyimpan...");
        const token = await getAuthToken();
        const res = await fetch('/.netlify/functions/save-session-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ characterId: currentCharacterId, sessionId: targetId, title: title })
        });

        if (res.ok) {
            showToast("Berhasil disimpan!");
            loadSessionsList(); 
        } else {
            showToast("Gagal menyimpan.");
        }
    } catch (e) { showToast("Error koneksi."); }
}

async function deleteSession(sessionId) {
    const confirmed = await showCustomConfirm("Hapus Sesi?", "Sesi ini akan dihapus permanen.");
    if (!confirmed) return;

    try {
        const token = await getAuthToken();
        const res = await fetch(`/.netlify/functions/delete-history?id=${currentCharacterId}&sessionId=${sessionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            showToast("Sesi dihapus.");
            if (currentSessionId === sessionId) {
                currentSessionId = null;
                startNewSession(true);
            } else {
                loadSessionsList();
            }
        } else { showToast("Gagal menghapus."); }
    } catch (e) { showToast("Error koneksi."); }
}

async function loadChatHistory(sessionId) {
    if(!sessionId) return;
    try {
        const token = await getAuthToken();
        const res = await fetch(`/.netlify/functions/get-history?id=${currentCharacterId}&sessionId=${sessionId}`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        if (!res.ok) return;
        const history = await res.json();
        
        chatTranscript.innerHTML = '';
        if (history.length === 0) {
            addMessageToTranscript(currentCharacterGreeting, 'bot');
        } else {
            history.forEach(m => addMessageToTranscript(m.text, m.sender, true));
        }
        scrollToBottom();
    } catch (e) { console.error(e); }
}

// === 4. MESSAGING & AI ===

async function handleSendMessage() {
    const text = chatInput.value.trim();
    if ((!text && !currentSelectedFile) || chatInput.disabled) return;
    
    chatInput.value = ''; 
    chatInput.disabled = true; sendButton.disabled = true;

    if (currentSelectedFile) {
        await handleFileUpload(currentSelectedFile, text);
    } else {
        addMessageToTranscript(text, 'user');
        lastUserMessage = text;
        await saveMessage('user', text);
        await triggerAI(text);
    }
    
    chatInput.disabled = false; sendButton.disabled = false; chatInput.focus();
}

async function saveMessage(sender, text) {
    try {
        const token = await getAuthToken();
        await fetch('/.netlify/functions/save-message', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ characterId: currentCharacterId, sender, text, sessionId: currentSessionId })
        });
    } catch (e) { console.error(e); }
}

async function triggerAI(messageContent) {
    showTypingIndicator();
    const headerStatus = document.getElementById('header-status');
    if(headerStatus) headerStatus.textContent = "Mengetik...";

    try {
        const token = await getAuthToken();
        let uName = "Kawan";
        const nameFromPersona = extractNameFromPersona(currentUserPersona);
        if (nameFromPersona) uName = nameFromPersona;
        else if(currentUser && currentUser.displayName) uName = currentUser.displayName;
        else if(currentUser && currentUser.email) uName = currentUser.email.split('@')[0];

        const res = await fetch('/.netlify/functions/get-chat-response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                userMessage: messageContent, 
                characterProfile: currentChatbotProfile, 
                characterName: currentCharacterName, 
                characterId: currentCharacterId, 
                userPersona: currentUserPersona, 
                userLocalTime: new Date().toLocaleString('id-ID'),
                userName: uName, 
                sessionId: currentSessionId 
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
    } finally {
        if(headerStatus) headerStatus.textContent = "Online";
    }
}

// === 5. UI UTILITIES ===

function addMessageToTranscript(text, sender, isHistory = false) {
    const container = document.createElement('div');
    container.className = `chat-bubble-container ${sender}`;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;

    const isImage = text && (text.startsWith('https://res.cloudinary.com') || text.startsWith('data:image'));
    if (isImage) {
        bubble.classList.add('image-bubble'); 
        const img = document.createElement('img'); img.src = text; 
        img.onclick = () => openImageViewer(text); 
        bubble.appendChild(img);
    } else if (text && typeof marked !== 'undefined' && sender === 'bot') {
        bubble.innerHTML = marked.parse(text); 
    } else {
        bubble.textContent = text; 
    }

    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-time';
    timeSpan.textContent = getCurrentTime();
    bubble.appendChild(timeSpan);
    container.appendChild(bubble);
    
    if (!isImage) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-icon-btn'; copyBtn.innerHTML = '📋';
        copyBtn.onclick = () => { navigator.clipboard.writeText(text); showToast('Disalin!'); };
        actionsDiv.appendChild(copyBtn);
        container.appendChild(actionsDiv);
    }

    chatTranscript.appendChild(container);
    if (sender === 'user' || isUserNearBottom || !isHistory) scrollToBottom();
}

function scrollToBottom() { chatTranscript.scrollTop = chatTranscript.scrollHeight; }
function handleScroll() { isUserNearBottom = (chatTranscript.scrollTop + chatTranscript.offsetHeight) >= (chatTranscript.scrollHeight - 100); }
function showTypingIndicator() {
    const div = document.createElement('div'); div.id = 'typing-indicator-bubble';
    div.className = 'chat-bubble-container bot';
    div.innerHTML = `<div class="chat-bubble bot"><div class="typing-indicator" style="margin:0; padding:0; background:none; box-shadow:none;"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
    chatTranscript.appendChild(div);
    scrollToBottom();
}
function removeTypingIndicator() { const el = document.getElementById('typing-indicator-bubble'); if(el) el.remove(); }
function closeMobileSidebar() {
    const lPanel = document.querySelector('.chat-left-panel');
    const mBack = document.getElementById('mobile-backdrop');
    if(lPanel) lPanel.classList.remove('mobile-visible');
    if(mBack) mBack.classList.remove('active');
}

function readFileAsBase64(f) { return new Promise((r,j)=>{const rd=new FileReader();rd.onload=()=>r(rd.result);rd.onerror=j;rd.readAsDataURL(f);}); }
async function handleFileUpload(f,c) {
    try {
        const b64 = await readFileAsBase64(f);
        addMessageToTranscript(b64, 'user'); cancelAttachment();
        const t = await getAuthToken();
        const res = await fetch('/.netlify/functions/upload-image', { 
            method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${t}`}, body:JSON.stringify({file:b64})
        });
        if(!res.ok) throw new Error();
        const d = await res.json();
        await saveMessage('user', d.secure_url);
        if(c) { addMessageToTranscript(c,'user'); await saveMessage('user',c); }
        await triggerAI(d.secure_url);
    } catch(e){ addMessageToTranscript("Gagal kirim gambar",'bot'); }
}
function cancelAttachment() { currentSelectedFile=null; document.getElementById('attachment-preview').classList.add('hidden'); fileInput.value=''; }
function openImageViewer(src) { const m=document.getElementById('image-viewer-modal'); const i=document.getElementById('full-image'); if(m&&i){ i.src=src; m.classList.add('active'); }}
async function loadUserPersona(id) {
    try {
        const t = await getAuthToken();
        const res = await fetch(`/.netlify/functions/manage-persona?charId=${id}`, {headers:{'Authorization':`Bearer ${t}`}});
        if(res.ok) { const d=await res.json(); currentUserPersona=d.persona||""; if(personaTextDisplay) personaTextDisplay.textContent=currentUserPersona||"Belum ada peran."; }
    } catch(e) {}
}

// === 6. INITIALIZATION & EVENT LISTENERS ===

document.addEventListener('DOMContentLoaded', async () => {
    chatTranscript = document.getElementById('chat-transcript');
    chatInput = document.getElementById('chat-input');
    sendButton = document.getElementById('send-button');
    uploadButton = document.getElementById('upload-btn');
    fileInput = document.getElementById('file-input');
    imageViewerModal = document.getElementById('image-viewer-modal');
    personaTextDisplay = document.getElementById('persona-text-display');
    
    if (!window.currentUser) await new Promise(resolve => document.addEventListener('authReady', resolve, { once: true }));
    currentUser = window.currentUser; if (!currentUser) return (window.location.href = 'login.html');

    const p = new URLSearchParams(window.location.search);
    currentCharacterId = p.get('id') || '1';

    initChat();

    // Event Listeners Dasar
    if(sendButton) sendButton.onclick = handleSendMessage;
    if(chatInput) chatInput.onkeydown = (e) => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }};
    if(uploadButton && fileInput) {
        uploadButton.onclick = () => fileInput.click();
        fileInput.onchange = (e) => {
            const f = e.target.files[0]; if(!f) return; currentSelectedFile=f;
            document.getElementById('preview-img').src = URL.createObjectURL(f);
            document.getElementById('attachment-preview').classList.remove('hidden');
        };
    }
    if(document.getElementById('btn-cancel-attach')) document.getElementById('btn-cancel-attach').onclick = cancelAttachment;
    
    backButton = document.getElementById('back-btn');
    if(backButton) backButton.onclick = () => window.location.href = 'index.html';

    if(document.querySelector('.close-viewer')) document.querySelector('.close-viewer').onclick = () => imageViewerModal.classList.remove('active');
    if(chatTranscript) chatTranscript.addEventListener('scroll', handleScroll);

    // Sidebar Mobile
    const mBack = document.getElementById('mobile-backdrop');
    const headerInfo = document.querySelector('.header-char-info');
    const headerAvatar = document.getElementById('header-char-avatar');
    const toggleSidebar = () => { document.querySelector('.chat-left-panel').classList.toggle('mobile-visible'); mBack.classList.toggle('active'); };
    
    if(headerInfo) headerInfo.onclick = toggleSidebar;
    if(headerAvatar) headerAvatar.onclick = toggleSidebar;
    if(document.getElementById('close-left-panel')) document.getElementById('close-left-panel').onclick = toggleSidebar;
    if(mBack) mBack.onclick = toggleSidebar;

    // Dropdown Menu
    const menuBtn = document.getElementById('menu-btn');
    if(menuBtn) menuBtn.onclick = (e) => { e.stopPropagation(); document.getElementById('chat-dropdown').classList.toggle('show'); };
    window.onclick = () => document.getElementById('chat-dropdown')?.classList.remove('show');

    // --- MENU DROPDOWN ACTIONS ---
    
    // 1. Simpan Sesi
    const btnSaveSession = document.getElementById('btn-save-session-dropdown');
    if (btnSaveSession) {
        btnSaveSession.onclick = () => {
            document.getElementById('chat-dropdown').classList.remove('show');
            saveCurrentSession(); 
        };
    }

    // 2. Atur Peran (Mobile)
    const mobPersonaBtn = document.getElementById('mobile-persona-btn-dropdown');
    if(mobPersonaBtn) {
        mobPersonaBtn.onclick = () => {
            document.getElementById('chat-dropdown').classList.remove('show');
            const pBox = document.querySelector('.persona-box');
            if(pBox) {
                document.getElementById('mobile-persona-content-area').appendChild(pBox);
                document.getElementById('mobile-persona-popup').classList.add('active');
                mBack.classList.add('active');
                document.querySelector('.chat-left-panel').classList.remove('mobile-visible');
            }
        };
    }
    const closeP = document.getElementById('close-persona-popup');
    if(closeP) closeP.onclick = () => {
        document.getElementById('mobile-persona-popup').classList.remove('active');
        mBack.classList.remove('active');
        document.querySelector('.chat-right-panel').appendChild(document.querySelector('.persona-box'));
    };

// 3. Hapus Chat (Reset Layar & Hapus Database)
    const delChatBtn = document.getElementById('delete-chat-item');
    if (delChatBtn) {
        delChatBtn.onclick = async () => {
            // Tutup menu dropdown
            document.getElementById('chat-dropdown').classList.remove('show');
            
            // Konfirmasi ke pengguna
            const sure = await showCustomConfirm('Hapus Chat?', 'Yakin ingin menghapus permanen sesi ini? MAI akan melupakan percakapan ini.');
            
            if (sure) {
                // Cek apakah ada sesi aktif yang perlu dihapus dari database
                if (currentSessionId) {
                    try {
                        showToast("Menghapus memori...");
                        const token = await getAuthToken();
                        
                        // Panggil fungsi delete-history di backend
                        // Kita kirimkan currentSessionId agar hanya sesi ini yang dihapus
                        const res = await fetch(`/.netlify/functions/delete-history?id=${currentCharacterId}&sessionId=${currentSessionId}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });

                        if (!res.ok) throw new Error("Gagal menghapus data di server");
                        
                    } catch (e) {
                        console.error("Gagal hapus db:", e);
                        showToast("Gagal menghapus data server, tapi layar akan dibersihkan.");
                    }
                }

                // Setelah data di server terhapus (atau jika ini sesi baru/draft),
                // Kita bersihkan layar dan mulai sesi baru yang bersih.
                startNewSession(true); 
                showToast("Layar & Memori dibersihkan.");
            }
        };
    }

// 4. Tombol Chat Baru (Dengan Konfirmasi Popup)
    const newChatBtn = document.getElementById('btn-new-chat');
    if (newChatBtn) {
        newChatBtn.onclick = async () => {
            // 1. Tutup menu dropdown dulu biar rapi
            document.getElementById('chat-dropdown').classList.remove('show');
            
            // 2. Tampilkan Popup Konfirmasi
            const sure = await showCustomConfirm(
                'Mulai Chat Baru?', 
                'Percakapan saat ini akan disimpan otomatis di riwayat. Anda ingin memulai topik baru?'
            );
            
            // 3. Jika User klik "Ya", baru kita reset layar
            if (sure) {
                startNewSession(true); 
                showToast("Lembaran baru dibuka! ✨");
            }
        };
    }

    // --- MODAL SAVE LISTENERS ---
    const btnCancelSave = document.getElementById('btn-cancel-save');
    const btnConfirmSave = document.getElementById('btn-confirm-save');
    const saveInput = document.getElementById('session-title-input');
    if (btnCancelSave) btnCancelSave.onclick = closeSaveModal;
    if (btnConfirmSave) btnConfirmSave.onclick = handleSaveConfirm;
    if (saveInput) saveInput.onkeydown = (e) => { if (e.key === 'Enter') handleSaveConfirm(); };

    // --- PERSONA EDIT ---
    const pDisplay = document.getElementById('persona-display-container');
    const pEdit = document.getElementById('persona-edit-container');
    const savePBtn = document.getElementById('save-persona-btn');
    document.getElementById('edit-persona-btn').onclick = () => { pDisplay.classList.add('hidden'); pEdit.classList.remove('hidden'); document.getElementById('user-persona-input').value = currentUserPersona; };
    document.getElementById('cancel-persona-btn').onclick = () => { pEdit.classList.add('hidden'); pDisplay.classList.remove('hidden'); };
    if(savePBtn) savePBtn.onclick = async () => {
        savePBtn.textContent = "Menyimpan...";
        const txt = document.getElementById('user-persona-input').value;
        try {
            const t = await getAuthToken();
            await fetch('/.netlify/functions/manage-persona', { method:'POST', headers:{'Authorization':`Bearer ${t}`}, body:JSON.stringify({charId:currentCharacterId, persona:txt}) });
            currentUserPersona=txt; personaTextDisplay.textContent=txt;
            pEdit.classList.add('hidden'); pDisplay.classList.remove('hidden');
        } catch(e) { showToast("Gagal simpan."); }
        savePBtn.textContent = "Simpan";
    };
});