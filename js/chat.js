// File: js/chat.js (FINAL VERSION: SUPPORT GAMBAR + PDF/DOCS)

// === 1. GLOBAL VARIABLES ===
let currentChatbotProfile = "", currentCharacterName = "", currentCharacterGreeting = "", currentCharacterId = "1";
let currentUser = null, currentAuthToken = null, currentUserPersona = "";
let chatTranscript, chatInput, sendButton, uploadButton, fileInput, backButton, maiSprite;
let personaDisplayContainer, personaEditContainer, personaTextDisplay, editPersonaBtn, savePersonaBtn, cancelPersonaBtn, personaInput, personaStatus;

// Variabel Mobile
let profileIcon, leftPanel, mobileBackdrop, closeLeftPanelBtn, mobilePersonaTrigger, mobilePersonaPopup, closePersonaPopupBtn, mobilePersonaContentArea;

// Variabel Preview & Upload
let attachmentPreview, previewImg, btnCancelAttach;
let currentSelectedFile = null;

// Variabel Image Viewer
let imageViewerModal, fullImage, closeViewerBtn;

// === 2. HELPER FUNCTIONS ===

function showCustomConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const msgEl = document.getElementById('confirm-msg');
        const yesBtn = document.getElementById('btn-confirm-yes');
        const cancelBtn = document.getElementById('btn-confirm-cancel');

        if (!modal) { resolve(confirm(message)); return; }

        titleEl.textContent = title;
        msgEl.textContent = message;
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('visible'), 10);

        const close = (result) => {
            modal.classList.remove('visible');
            setTimeout(() => modal.style.display = 'none', 300);
            yesBtn.onclick = null;
            cancelBtn.onclick = null;
            resolve(result);
        };
        yesBtn.onclick = () => close(true);
        cancelBtn.onclick = () => close(false);
    });
}

function openImageViewer(src) {
    if (imageViewerModal && fullImage) {
        fullImage.src = src;
        imageViewerModal.classList.add('active');
    }
}

function closeImageViewer() {
    if (imageViewerModal) {
        imageViewerModal.classList.remove('active');
        setTimeout(() => { if(fullImage) fullImage.src = ''; }, 200);
    }
}

async function getAuthToken() {
    if (!currentUser) { 
        if (window.currentUser) currentUser = window.currentUser;
        else { window.location.href = 'login.html'; throw new Error("User null"); }
    }
    try { 
        currentAuthToken = await currentUser.getIdToken(true); 
        return currentAuthToken; 
    } catch (error) { console.error("Gagal get token:", error); throw error; }
}

// --- FUNGSI BARU: ANIMASI TYPING ---
function showTypingIndicator() {
    const container = document.createElement('div');
    container.id = 'typing-indicator-bubble'; // ID unik biar gampang dihapus
    container.className = 'typing-indicator';
    
    // Buat 3 titik
    container.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    
    chatTranscript.appendChild(container);
    chatTranscript.scrollTop = chatTranscript.scrollHeight;
}

function removeTypingIndicator() {
    const existing = document.getElementById('typing-indicator-bubble');
    if (existing) {
        existing.remove();
    }
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

// === 4. LOGIKA MOBILE UI ===
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
    const personaBox = document.querySelector('.persona-box');
    const originalParent = document.querySelector('.chat-right-panel');
    
    if (show) {
        if (personaBox && mobilePersonaContentArea) {
            mobilePersonaContentArea.appendChild(personaBox);
            mobilePersonaPopup.classList.add('active');
            mobileBackdrop.classList.add('active');
            leftPanel.classList.remove('mobile-visible');
        }
    } else {
        if (personaBox && originalParent) {
            originalParent.appendChild(personaBox);
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
        
        currentChatbotProfile = char.description; 
        currentCharacterName = char.name; 
        currentCharacterGreeting = char.greeting;
        
        document.querySelector('.profile-info-container .profile-name').textContent = char.name;
        maiSprite = document.getElementById('mai-sprite');
        if (maiSprite) { maiSprite.src = char.image; maiSprite.classList.add('anim-idle'); }
        document.querySelector('.chat-left-panel').classList.remove('is-loading');

        let isAdmin = false;
        if (currentUser) {
            try {
                const tokenResult = await currentUser.getIdTokenResult();
                isAdmin = tokenResult.claims.admin === true;
            } catch(e) { console.log(e); }
        }

        if (currentUser && (char.creatorId === currentUser.uid || isAdmin)) {
            const existingBtn = document.getElementById('edit-char-btn');
            if (!existingBtn) {
                const btn = document.createElement('button');
                btn.id = 'edit-char-btn'; 
                btn.textContent = (isAdmin && char.creatorId !== currentUser.uid) ? '⚡ Edit (Mode Admin)' : '✏️ Edit Karakter';
                Object.assign(btn.style, { 
                    marginTop: '8px', width: '100%', padding: '8px', 
                    backgroundColor: (isAdmin && char.creatorId !== currentUser.uid) ? '#ffca28' : '#e0e0e0',
                    border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#333' 
                });
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
        if (history.length > 0 && chatTranscript) chatTranscript.innerHTML = '';
        
        history.forEach(m => addMessageToTranscript(m.text, m.sender));
        
        if (history.length === 0 && botBubble) botBubble.textContent = currentCharacterGreeting;
        else if (history.length === 0 && chatTranscript) {
             const greetingDiv = document.createElement('div');
             greetingDiv.className = 'chat-bubble bot';
             greetingDiv.textContent = currentCharacterGreeting;
             chatTranscript.appendChild(greetingDiv);
        }

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

// --- HANDLE FILE SELECTED (PREVIEW - SUPPORT PDF) ---
function handleFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;
    currentSelectedFile = file;

    // Cek Tipe File
    if (file.type.startsWith('image/')) {
        // Jika Gambar -> Tampilkan Preview Asli
        const reader = new FileReader();
        reader.onload = (event) => {
            previewImg.src = event.target.result;
            attachmentPreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    } else {
        // Jika PDF/Docs -> Tampilkan Ikon Dokumen
        // Kita pakai icon dokumen generik
        previewImg.src = "https://cdn-icons-png.flaticon.com/512/337/337946.png"; 
        attachmentPreview.classList.remove('hidden');
    }
    chatInput.focus();
}

function cancelAttachment() {
    currentSelectedFile = null;
    fileInput.value = ''; 
    attachmentPreview.classList.add('hidden'); 
}

// --- HANDLE SEND MESSAGE ---
async function handleSendMessage() {
    const text = chatInput.value.trim();
    if ((!text && !currentSelectedFile) || chatInput.disabled) return;
    setChatInputDisabled(true);

    if (currentSelectedFile) {
        if (currentSelectedFile.size > 4 * 1024 * 1024) { // Naikkan limit ke 10MB buat PDF
            alert("Maaf, ukuran file terlalu besar (Maks 10MB).");
            setChatInputDisabled(false);
            return;
        }

        try {
            // 1. Simpan file lokal
            const fileToUpload = currentSelectedFile;
            
            // 2. Tampilkan UI Chat sementara
            let tempDisplay = previewImg.src; 
            if (!fileToUpload.type.startsWith('image/')) {
                // Jika dokumen, beri pesan teks dulu
                addMessageToTranscript(`📄 Mengirim dokumen: ${fileToUpload.name}...`, 'user');
            } else {
                addMessageToTranscript(tempDisplay, 'user'); 
            }
            
            cancelAttachment(); 

            // 3. Konversi ke Base64
            const base64 = await readFileAsBase64(fileToUpload);
            
            // 4. Upload
            const token = await getAuthToken();
            const uploadRes = await fetch('/.netlify/functions/upload-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ file: base64 })
            });

            if (!uploadRes.ok) {
                const errData = await uploadRes.json();
                throw new Error(errData.error || "Gagal upload file");
            }
            const uploadData = await uploadRes.json();
            const realFileUrl = uploadData.secure_url;

            // 5. Simpan Pesan (URL File)
            await saveMessage('user', realFileUrl);
            
            // 6. Jika dokumen, update UI jadi Link
            if (!fileToUpload.type.startsWith('image/')) {
               // Tidak perlu update transcript lagi, biarkan AI yang respon
               // atau bisa tambahkan link download manual disini jika mau
            }

            if (text) {
                addMessageToTranscript(text, 'user');
                await saveMessage('user', text);
            }
            
            await triggerAI(realFileUrl); 

        } catch (error) {
            console.error(error);
            addMessageToTranscript("❌ Gagal mengirim file.", 'bot');
            setChatInputDisabled(false);
            return; 
        }
    } else if (text) {
        addMessageToTranscript(text, 'user');
        await saveMessage('user', text);
        await triggerAI(text);
    }

    chatInput.value = ''; 
    chatInput.style.height = '50px';
    setChatInputDisabled(false);
    chatInput.focus();
}

async function triggerAI(messageContent) {
    // 1. Munculkan Animasi Titik-Titik
    showTypingIndicator(); 
    
    try {
        const token = await getAuthToken();
        const res = await fetch('/.netlify/functions/get-chat-response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                userMessage: messageContent, 
                characterProfile: currentChatbotProfile, 
                characterName: currentCharacterName, 
                characterId: currentCharacterId, 
                userPersona: currentUserPersona 
            })
        });
        
        // 2. Hapus Animasi Titik-Titik (Entah sukses atau gagal)
        removeTypingIndicator();

        if (!res.ok) throw new Error("Gagal server.");
        const data = await res.json();
        
        // 3. Buat Bubble Baru & Mulai Efek Mengetik Teks
        // Kita buat bubble kosong dulu
        const botBubble = addMessageToTranscript("", 'bot'); 
        
        // Jalankan efek ketikan mesin tik
        typeText(botBubble, data.reply);
        
        await saveMessage('bot', data.reply);

    } catch (e) {
        removeTypingIndicator(); // Pastikan animasi hilang kalau error
        // Tampilkan pesan error
        const errorBubble = addMessageToTranscript("Maaf, koneksi terputus.", 'bot');
        errorBubble.style.color = 'red';
    }
}

function setChatInputDisabled(d) { chatInput.disabled = d; sendButton.disabled = d; if (uploadButton) uploadButton.disabled = d; }

function readFileAsBase64(file) {
    if (file instanceof File) {
         return new Promise((resolve, reject) => {
            const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file);
        });
    }
    return Promise.resolve(file); 
}

// --- UPDATE FUNGSI INI: HANDLE GAMBAR VS DOKUMEN DI CHAT ---
// File: js/chat.js (Cari fungsi ini di paling bawah dan GANTI)

function addMessageToTranscript(text, sender, extra) {
    const d = document.createElement('div'); 
    d.classList.add('chat-bubble', sender);
    
    if (extra) d.classList.add(extra);
    
    // ▼▼▼ PERBAIKAN DISINI ▼▼▼
    // Cek apakah teks adalah URL Cloudinary ATAU data gambar Base64 (Preview)
    const isCloudinary = text && text.startsWith('https://res.cloudinary.com');
    const isBase64 = text && text.startsWith('data:image');

    if (isCloudinary || isBase64) {
        d.classList.add('image-bubble'); 
        const i = document.createElement('img'); 
        i.src = text; 
        
        // Event klik untuk membuka gambar besar (Lightbox)
        i.onclick = () => openImageViewer(text); 
        i.style.cursor = 'zoom-in';
        
        d.appendChild(i);
    } 
    // Cek PDF (tetap sama)
    else if (text && text.toLowerCase().endsWith('.pdf')) {
        d.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:24px;">📄</span>
                <a href="${text}" target="_blank" style="color:inherit; text-decoration:underline;">
                    Buka Dokumen PDF
                </a>
            </div>`;
        d.classList.add('file-bubble'); 
    } 
    // Teks biasa
    else { 
        d.textContent = text; 
    }
    // ▲▲▲ AKHIR PERBAIKAN ▲▲▲

    chatTranscript.appendChild(d); 
    chatTranscript.scrollTop = chatTranscript.scrollHeight; 
    return d;
}

// === 6. INIT & EVENT LISTENERS ===
document.addEventListener('DOMContentLoaded', async () => {
    chatTranscript = document.getElementById('chat-transcript');
    chatInput = document.getElementById('chat-input');
    sendButton = document.getElementById('send-button');
    backButton = document.getElementById('back-btn');
    uploadButton = document.getElementById('upload-btn');
    fileInput = document.getElementById('file-input');
    maiSprite = document.getElementById('mai-sprite');

    // Preview & Viewer Elements
    attachmentPreview = document.getElementById('attachment-preview');
    previewImg = document.getElementById('preview-img');
    btnCancelAttach = document.getElementById('btn-cancel-attach');
    
    // Init Image Viewer
    imageViewerModal = document.getElementById('image-viewer-modal');
    fullImage = document.getElementById('full-image');
    closeViewerBtn = document.querySelector('.close-viewer');

    if (closeViewerBtn) closeViewerBtn.onclick = closeImageViewer;
    if (imageViewerModal) imageViewerModal.onclick = (e) => {
        if (e.target === imageViewerModal) closeImageViewer();
    };

    personaDisplayContainer = document.getElementById('persona-display-container');
    personaEditContainer = document.getElementById('persona-edit-container');
    personaTextDisplay = document.getElementById('persona-text-display');
    editPersonaBtn = document.getElementById('edit-persona-btn');
    savePersonaBtn = document.getElementById('save-persona-btn');
    cancelPersonaBtn = document.getElementById('cancel-persona-btn');
    personaInput = document.getElementById('user-persona-input');
    personaStatus = document.getElementById('persona-status');
    
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

    // --- Listeners Chat ---
    if (sendButton) sendButton.onclick = handleSendMessage;
    if (chatInput) {
        chatInput.onkeydown = (e) => { if (!chatInput.disabled && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } };
        chatInput.addEventListener('input', function() {
            this.style.height = 'auto'; 
            const newHeight = Math.max(50, this.scrollHeight);
            this.style.height = newHeight + 'px';
        });
    }

    if (backButton) backButton.onclick = () => window.location.href = 'index.html';
    if (uploadButton) uploadButton.onclick = () => fileInput.click();
    if (fileInput) fileInput.onchange = (e) => handleFileSelected(e);
    
    if (btnCancelAttach) btnCancelAttach.onclick = cancelAttachment;

    if (editPersonaBtn) editPersonaBtn.onclick = () => togglePersonaMode(true);
    if (cancelPersonaBtn) cancelPersonaBtn.onclick = () => togglePersonaMode(false);
    if (savePersonaBtn) savePersonaBtn.onclick = saveUserPersona;

    if (profileIcon) profileIcon.onclick = () => toggleMobileLeftPanel(true);
    if (closeLeftPanelBtn) closeLeftPanelBtn.onclick = () => toggleMobileLeftPanel(false);
    if (mobileBackdrop) mobileBackdrop.onclick = () => {
        toggleMobileLeftPanel(false);
        toggleMobilePersonaPopup(false);
    };
    if (mobilePersonaTrigger) {
        if (window.innerWidth <= 768) mobilePersonaTrigger.style.display = 'block';
        mobilePersonaTrigger.onclick = () => toggleMobilePersonaPopup(true);
    }
    if (closePersonaPopupBtn) closePersonaPopupBtn.onclick = () => toggleMobilePersonaPopup(false);

    const menuBtn = document.getElementById('menu-btn');
    const dropdown = document.getElementById('chat-dropdown');
    const deleteItem = document.getElementById('delete-chat-item');

    if (menuBtn && dropdown) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            dropdown.classList.toggle('show');
            menuBtn.classList.toggle('active');
        });
        window.addEventListener('click', () => {
            if (dropdown.classList.contains('show')) {
                dropdown.classList.remove('show');
                menuBtn.classList.remove('active');
            }
        });
    }

    if (deleteItem) {
        deleteItem.addEventListener('click', async () => {
            const isConfirmed = await showCustomConfirm("Hapus Riwayat Chat?", "Semua percakapan dengan karakter ini akan dihapus permanen. Lanjutkan?");
            if (!isConfirmed) return;

            const originalText = deleteItem.innerHTML;
            deleteItem.innerHTML = '⏳ Menghapus...';
            deleteItem.disabled = true;

            try {
                const token = await getAuthToken();
                const res = await fetch(`/.netlify/functions/delete-history?id=${currentCharacterId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.ok) {
                    chatTranscript.innerHTML = '';
                    const greetingBubble = document.createElement('div');
                    greetingBubble.className = 'chat-bubble bot';
                    greetingBubble.textContent = currentCharacterGreeting || "Halo!";
                    chatTranscript.appendChild(greetingBubble);
                    const historyList = document.getElementById('chat-history-list');
                    if (historyList) historyList.innerHTML = '<p class="empty-state">Belum ada riwayat.</p>';
                    dropdown.classList.remove('show');
                } else { throw new Error("Gagal menghapus."); }
            } catch (err) { console.error(err); alert("Gagal menghapus chat."); } 
            finally { deleteItem.innerHTML = originalText; deleteItem.disabled = false; }
        });
    }
});