// File: js/create-mai.js
// VERSI: CUSTOM ALERTS & MODALS

// --- 1. HELPER FUNGSI (MODAL SYSTEM) ---

// A. Fungsi Alert Cantik
function showCustomAlert(title, message, icon = '✨') {
    return new Promise((resolve) => {
        const modal = document.getElementById('universal-modal');
        const titleEl = document.getElementById('u-modal-title');
        const msgEl = document.getElementById('u-modal-msg');
        const iconEl = document.getElementById('u-modal-icon');
        const actionsEl = document.getElementById('u-modal-actions');

        if (!modal) { alert(message); resolve(); return; } // Fallback

        titleEl.textContent = title;
        msgEl.textContent = message;
        iconEl.textContent = icon;
        
        actionsEl.innerHTML = `
            <button id="btn-modal-ok" style="background: var(--primary-color, #667eea); color: white; border: none; padding: 10px 25px; border-radius: 8px; cursor: pointer; font-weight: bold;">
                Oke, Paham
            </button>
        `;

        modal.classList.add('visible');
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';

        document.getElementById('btn-modal-ok').onclick = () => {
            modal.classList.remove('visible');
            modal.style.opacity = '0';
            modal.style.visibility = 'hidden';
            resolve();
        };
    });
}

// B. Fungsi Confirm Cantik
function showCustomConfirm(title, message, icon = '🤔') {
    return new Promise((resolve) => {
        const modal = document.getElementById('universal-modal');
        const titleEl = document.getElementById('u-modal-title');
        const msgEl = document.getElementById('u-modal-msg');
        const iconEl = document.getElementById('u-modal-icon');
        const actionsEl = document.getElementById('u-modal-actions');

        if (!modal) { resolve(confirm(message)); return; }

        titleEl.textContent = title;
        msgEl.textContent = message;
        iconEl.textContent = icon;
        
        actionsEl.innerHTML = `
            <button id="btn-modal-cancel" style="background: transparent; color: #666; border: 1px solid #ccc; padding: 10px 20px; border-radius: 8px; cursor: pointer;">Batal</button>
            <button id="btn-modal-yes" style="background: var(--primary-color, #667eea); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold;">Ya, Lanjut</button>
        `;

        modal.classList.add('visible');
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';

        document.getElementById('btn-modal-cancel').onclick = () => {
            modal.classList.remove('visible');
            modal.style.opacity = '0';
            modal.style.visibility = 'hidden';
            resolve(false);
        };

        document.getElementById('btn-modal-yes').onclick = () => {
            modal.classList.remove('visible');
            modal.style.opacity = '0';
            modal.style.visibility = 'hidden';
            resolve(true);
        };
    });
}

// --- 2. AUTH & UPLOAD HELPER ---

function getAuthTokenSafe() {
    return new Promise((resolve, reject) => {
        if (typeof firebase === 'undefined') return reject(new Error("Firebase SDK belum dimuat."));
        const auth = firebase.auth();
        const user = auth.currentUser;
        if (user) {
            user.getIdToken(true).then(resolve).catch(reject);
        } else {
            const unsubscribe = auth.onAuthStateChanged((user) => {
                unsubscribe();
                if (user) {
                    user.getIdToken(true).then(resolve).catch(reject);
                } else {
                    reject(new Error("User tidak login."));
                }
            });
        }
    });
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

async function uploadSingleImage(file, token) {
    try {
        const base64 = await readFileAsBase64(file);
        const res = await fetch('/.netlify/functions/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ file: base64 })
        });
        if (!res.ok) throw new Error("Gagal upload gambar.");
        const data = await res.json();
        return data.secure_url;
    } catch (e) {
        console.error("Upload Error:", e);
        throw e;
    }
}

// --- 3. UI FUNCTIONS ---

window.updateFileName = function(input, labelId) {
    const label = document.getElementById(labelId);
    if (!label) return;

    if (input.files && input.files[0]) {
        if (label.classList.contains('sprite-upload-box')) {
            label.innerHTML = `<div class="icon" style="font-size:1.5rem; margin-bottom:5px;">✅</div><span style="font-size:0.8rem;">${input.files[0].name.substring(0,10)}...</span>`;
            label.style.borderColor = "#28a745";
            label.style.background = "rgba(40, 167, 69, 0.1)";
            label.classList.add('has-file');
        } else {
            label.innerText = "✅ " + input.files[0].name;
            label.style.background = "#e6fffa";
            label.style.borderColor = "#2ecc71";
            label.style.color = "#2ecc71";
        }
    }
};

window.switchTab = function(tabName) {
    if (tabName === 'tab-visual') {
        const btn = document.getElementById('btn-tab-visual');
        if (btn && !btn.classList.contains('enabled')) { 
            showCustomAlert("Akses Ditolak", "Aktifkan 'Mode Visual' di Tab Identitas terlebih dahulu!", "🔒"); 
            return; 
        }
    }
    if (tabName === 'tab-skenario') {
        const btn = document.getElementById('btn-tab-skenario');
        if (btn && !btn.classList.contains('enabled')) { 
            showCustomAlert("Akses Ditolak", "Aktifkan 'Story Mode' di Tab Identitas terlebih dahulu!", "🔒"); 
            return; 
        }
    }

    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    const targetContent = document.getElementById(tabName);
    if(targetContent) targetContent.classList.add('active');
    
    const btns = document.querySelectorAll('.tab-btn');
    if (tabName === 'tab-identitas') btns[0]?.classList.add('active');
    if (tabName === 'tab-visual') btns[1]?.classList.add('active');
    if (tabName === 'tab-skenario') btns[2]?.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.handleNextStep = function() {
    const checkVN = document.getElementById('check-is-vn');
    if (checkVN && checkVN.checked) {
        window.switchTab('tab-visual');
    } else {
        document.getElementById('submit-btn').scrollIntoView({ behavior: 'smooth' });
    }
};

window.addChapterInput = function() {
    const container = document.getElementById('chapters-container');
    if (!container) return;

    const index = container.children.length + 1;
    const uniqueId = Date.now(); 

    const html = `
    <div class="chapter-item" id="chap-item-${uniqueId}">
        <div style="margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
            <strong style="font-size:1.1rem; color:#333;">Chapter #${index}</strong>
            <button type="button" onclick="document.getElementById('chap-item-${uniqueId}').remove()" style="float:right; color:#ff6b6b; background:none; border:none; cursor:pointer; font-weight:bold;">🗑️ Hapus</button>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 2fr; gap:15px; margin-bottom:15px;">
            <div>
                <label style="font-size:0.8rem; font-weight:bold; color:#555;">ID Unik (Wajib)</label>
                <input type="text" value="chap${index}" class="chap-id" placeholder="contoh: chap1" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; background:#f9f9f9;">
            </div>
            <div>
                <label style="font-size:0.8rem; font-weight:bold; color:#555;">Judul Chapter</label>
                <input type="text" class="chap-title" placeholder="Judul yang tampil di kartu" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">
            </div>
        </div>
        <div style="margin-bottom:15px;">
            <label style="font-size:0.8rem; font-weight:bold; color:#555;">Deskripsi Singkat</label>
            <textarea class="chap-desc" rows="2" placeholder="Sinopsis..." style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;"></textarea>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
            <div>
                <label style="font-size:0.8rem; font-weight:bold; color:#555;">Syarat Buka (ID)</label>
                <input type="text" class="chap-required" placeholder="Kosongkan jika bab 1" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">
            </div>
             <div>
                <label style="font-size:0.8rem; font-weight:bold; color:#2ecc71;">Game Goal (Misi)</label>
                <input type="text" class="chap-goal" placeholder="Contoh: Buat tertawa" style="width:100%; padding:8px; border:1px solid #2ecc71; border-radius:4px;">
            </div>
        </div>
    </div>`;
    container.insertAdjacentHTML('beforeend', html);
};

function getChaptersFromUI() {
    const items = document.querySelectorAll('.chapter-item');
    let chapters = [];
    items.forEach((item) => {
        const id = item.querySelector('.chap-id').value.trim();
        const title = item.querySelector('.chap-title').value.trim();
        const desc = item.querySelector('.chap-desc').value.trim();
        let required = item.querySelector('.chap-required').value.trim();
        const gameGoal = item.querySelector('.chap-goal').value.trim();

        if (required === "") required = null;
        if(id && title) chapters.push({ id, title, desc, required, gameGoal });
    });
    return chapters;
}


// --- 4. MAIN LOGIC ---

document.addEventListener('DOMContentLoaded', () => {

    const checkVN = document.getElementById('check-is-vn');
    const checkStory = document.getElementById('check-is-story');
    const btnTabVisual = document.getElementById('btn-tab-visual');
    const btnTabStory = document.getElementById('btn-tab-skenario');
    const containerChap = document.getElementById('chapters-container');

    if (containerChap && containerChap.children.length === 0) window.addChapterInput();

    // LOGIKA TOGGLE
    if (checkVN) {
        checkVN.addEventListener('change', (e) => {
            if (e.target.checked) {
                if(btnTabVisual) { btnTabVisual.classList.add('enabled'); btnTabVisual.innerHTML = '2. Visual (VN)'; }
            } else {
                if(btnTabVisual) { btnTabVisual.classList.remove('enabled'); btnTabVisual.innerHTML = '🔒 2. Visual (VN)'; }
                if (checkStory && checkStory.checked) {
                    checkStory.checked = false;
                    checkStory.dispatchEvent(new Event('change'));
                }
            }
        });
    }

    if (checkStory) {
        checkStory.addEventListener('change', async (e) => {
            if (e.target.checked) {
                if(btnTabStory) { btnTabStory.classList.add('enabled'); btnTabStory.innerHTML = '3. Skenario (Story)'; }
                if (checkVN && !checkVN.checked) {
                    checkVN.checked = true;
                    checkVN.dispatchEvent(new Event('change'));
                    await showCustomAlert("Info Sistem", "Mode Visual otomatis diaktifkan karena Story Mode membutuhkan aset gambar.", "ℹ️");
                }
            } else {
                if(btnTabStory) { btnTabStory.classList.remove('enabled'); btnTabStory.innerHTML = '🔒 3. Skenario (Story)'; }
            }
        });
    }

    // BG Uploader Logic
    const bgInput = document.getElementById('vn-bg-file');
    const bgUrlField = document.getElementById('vn-bg-url');
    if(bgInput) {
        bgInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if(!file) return;
            try {
                bgUrlField.value = "Uploading...";
                const token = await getAuthTokenSafe();
                const url = await uploadSingleImage(file, token);
                bgUrlField.value = url;
            } catch(e) { 
                showCustomAlert("Gagal", "Upload Background gagal.", "❌");
                bgUrlField.value = "";
            }
        });
    }

    // SUBMIT FORM
    const form = document.getElementById('create-mai-form');
    const statusMsg = document.getElementById('form-status');
    const submitBtn = document.getElementById('submit-btn');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            let token;
            try { 
                token = await getAuthTokenSafe(); 
            } catch (err) { 
                await showCustomAlert("Akses Ditolak", "Anda harus login terlebih dahulu!", "🛑");
                return; 
            }

            const isVn = checkVN ? checkVN.checked : false;
            const isStory = checkStory ? checkStory.checked : false;
            const bgUrl = document.getElementById('vn-bg-url') ? document.getElementById('vn-bg-url').value : "";

            if (isVn && !bgUrl) {
                await showCustomAlert("Data Belum Lengkap", "Anda mengaktifkan Mode Visual, tapi Background belum diisi!\nSilakan buka Tab 2.", "🖼️");
                window.switchTab('tab-visual');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = "⏳ Sedang Membuat...";
            statusMsg.textContent = "Menyiapkan data...";
            statusMsg.style.color = "blue";

            try {
                // Upload Avatar
                let imageUrl = null;
                const avatarInput = document.getElementById('mai-image');
                const avatarPreview = document.getElementById('avatar-preview');
                if (avatarInput && avatarInput.files[0]) {
                    statusMsg.textContent = "Mengupload avatar utama...";
                    imageUrl = await uploadSingleImage(avatarInput.files[0], token);
                } else if (avatarPreview) {
                    imageUrl = avatarPreview.src;
                }

                // Upload Sprites
                const sprites = {};
                if (isVn) {
                    if (imageUrl) sprites['idle'] = imageUrl; 
                    const emotions = ['happy', 'sad', 'angry', 'shy', 'surprised'];
                    for (const emo of emotions) {
                        const input = document.getElementById(`sprite-${emo}`);
                        if (input && input.files[0]) {
                            statusMsg.textContent = `Mengupload sprite: ${emo}...`;
                            const url = await uploadSingleImage(input.files[0], token);
                            sprites[emo] = url;
                        }
                    }
                }

                // Chapters & Goal
                let chapters = [];
                let gameGoal = "";
                if (isStory) {
                    chapters = getChaptersFromUI();
                    const goalInput = document.getElementById('mai-game-goal');
                    if(goalInput) gameGoal = goalInput.value;

                    if (chapters.length === 0) {
                        const proceed = await showCustomConfirm("Perhatian", "Story Mode aktif tapi Anda belum membuat Chapter satupun. Lanjut?", "⚠️");
                        if (!proceed) {
                            submitBtn.disabled = false;
                            submitBtn.textContent = "✨ CIPTAKAN KARAKTER";
                            statusMsg.textContent = "";
                            window.switchTab('tab-skenario');
                            return;
                        }
                    }
                }

                // Payload
                const getValue = (id) => document.getElementById(id) ? document.getElementById(id).value : "";
                const tagsVal = getValue('mai-tags');
                const tagsArray = tagsVal ? tagsVal.split(',').map(t => t.trim()).filter(t=>t) : [];
                
                const payload = {
                    name: getValue('mai-name'),
                    greeting: getValue('mai-greeting'),
                    tagline: getValue('mai-tagline'),
                    description: getValue('mai-description'),
                    tags: tagsArray,
                    visibility: document.querySelector('input[name="visibility"]:checked').value,
                    image: imageUrl,
                    isVnAvailable: isVn,
                    isStoryAvailable: isStory,
                    sprites: sprites,
                    backgroundImage: isVn ? bgUrl : "",
                    gameGoal: gameGoal,
                    chapters: chapters
                };

                statusMsg.textContent = "Menyimpan ke database...";
                const res = await fetch('/.netlify/functions/save-mai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const errRes = await res.json();
                    throw new Error(errRes.error || "Gagal menyimpan data.");
                }

                await showCustomAlert("Berhasil!", "Karakter berhasil diciptakan! Mengalihkan ke halaman depan...", "🎉");
                
                sessionStorage.removeItem('mai_chars_user');
                sessionStorage.removeItem('mai_chars_guest');
                window.location.href = 'index.html';

            } catch (err) {
                console.error("Submit Error:", err);
                statusMsg.textContent = "❌ Gagal";
                await showCustomAlert("Error", err.message, "❌");
                submitBtn.disabled = false;
                submitBtn.textContent = "Coba Lagi";
            }
        });
    }

    // --- SIDEBAR MOBILE LOGIC (FIXED) ---
    const hb = document.getElementById('hamburger-btn');
    const sb = document.getElementById('lobby-sidebar');
    const ov = document.getElementById('menu-overlay');

    if (hb && sb && ov) {
        // Buka Sidebar
        hb.addEventListener('click', (e) => {
            e.preventDefault(); // Mencegah refresh jika button ada di dalam form
            e.stopPropagation(); // Mencegah event bubbling
            sb.classList.add('sidebar-visible');
            ov.classList.add('overlay-visible');
        });

        // Tutup Sidebar (Klik Overlay)
        ov.addEventListener('click', () => {
            sb.classList.remove('sidebar-visible');
            ov.classList.remove('overlay-visible');
        });

        // Tutup Sidebar (Klik Link Menu)
        sb.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                sb.classList.remove('sidebar-visible');
                ov.classList.remove('overlay-visible');
            });
        });
    }
});