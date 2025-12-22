// File: js/edit-mai.js
// VERSI: CUSTOM MODALS & ALERTS

let currentData = {};

// --- 1. MODAL HELPER SYSTEM ---

function showCustomAlert(title, message, icon = '✨') {
    return new Promise((resolve) => {
        const modal = document.getElementById('universal-modal');
        const titleEl = document.getElementById('u-modal-title');
        const msgEl = document.getElementById('u-modal-msg');
        const iconEl = document.getElementById('u-modal-icon');
        const actionsEl = document.getElementById('u-modal-actions');

        if (!modal) { alert(message); resolve(); return; }

        titleEl.textContent = title;
        msgEl.textContent = message;
        iconEl.textContent = icon;
        
        actionsEl.innerHTML = `<button id="btn-modal-ok" style="background: var(--primary-color, #667eea); color: white; border: none; padding: 10px 25px; border-radius: 8px; cursor: pointer;">Oke</button>`;

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

function showCustomConfirm(title, message, icon = '🤔', yesLabel="Ya, Lanjut", isDanger=false) {
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
        
        const yesColor = isDanger ? '#dc3545' : 'var(--primary-color, #667eea)';
        
        actionsEl.innerHTML = `
            <button id="btn-modal-cancel" style="background: transparent; color: #666; border: 1px solid #ccc; padding: 10px 20px; border-radius: 8px; cursor: pointer;">Batal</button>
            <button id="btn-modal-yes" style="background: ${yesColor}; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold;">${yesLabel}</button>
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
        if (typeof firebase === 'undefined') return reject(new Error("Firebase SDK belum dimuat"));
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
    } catch(e) {
        console.error("Upload Error:", e);
        throw e;
    }
}

// --- 3. UI FUNCTIONS ---

window.updateFileName = function(input, labelId) {
    const label = document.getElementById(labelId);
    if (!label) return;
    if (input.files && input.files[0]) {
        const fname = input.files[0].name.substring(0,10) + "...";
        if (label.classList.contains('sprite-upload-box')) {
            label.innerHTML = `<div class="icon" style="font-size:1.5rem; margin-bottom:5px;">✅</div><span style="font-size:0.8rem;">${fname}</span>`;
            label.style.borderColor = "#28a745";
            label.classList.add('has-file');
        } else {
            label.innerText = "✅ " + fname;
            label.style.borderColor = "#2ecc71";
            label.style.color = "#2ecc71";
        }
    }
};

window.switchTab = function(tabName) {
    if (tabName === 'tab-visual') {
        const btn = document.getElementById('btn-tab-visual');
        if (btn && !btn.classList.contains('enabled')) { 
            showCustomAlert("Info", "Aktifkan 'Mode Visual' di Tab Identitas dulu!", "ℹ️"); return; 
        }
    }
    if (tabName === 'tab-skenario') {
        const btn = document.getElementById('btn-tab-skenario');
        if (btn && !btn.classList.contains('enabled')) { 
            showCustomAlert("Info", "Aktifkan 'Story Mode' di Tab Identitas dulu!", "ℹ️"); return; 
        }
    }

    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    const target = document.getElementById(tabName);
    if(target) target.classList.add('active');
    
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

window.addChapterInput = function(data = null) {
    const container = document.getElementById('chapters-container');
    if (!container) return;
    
    const index = container.children.length + 1; 
    const uniqueId = Date.now() + Math.floor(Math.random() * 1000);

    const valId = data ? data.id : `chap${index}`;
    const valTitle = data ? data.title : "";
    const valDesc = data ? data.desc : "";       
    const valRequired = data ? data.required : ""; 
    const valGoal = data ? data.gameGoal : "";     

    const html = `
    <div class="chapter-item" id="item-${uniqueId}">
        <div style="margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
            <strong style="font-size:1.1rem; color:#333;">Chapter #${index}</strong>
            <button type="button" onclick="document.getElementById('item-${uniqueId}').remove()" style="float:right; color:#ff6b6b; background:none; border:none; cursor:pointer; font-weight:bold;">🗑️ Hapus</button>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 2fr; gap:15px; margin-bottom:15px;">
            <div>
                <label style="font-size:0.8rem; font-weight:bold; color:#555;">ID Unik</label>
                <input type="text" value="${valId}" class="chap-id" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">
            </div>
            <div>
                <label style="font-size:0.8rem; font-weight:bold; color:#555;">Judul</label>
                <input type="text" value="${valTitle}" class="chap-title" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">
            </div>
        </div>
        <div style="margin-bottom:15px;">
            <label style="font-size:0.8rem; font-weight:bold; color:#555;">Deskripsi Singkat</label>
            <textarea class="chap-desc" rows="2" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">${valDesc}</textarea>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
            <div>
                <label style="font-size:0.8rem; font-weight:bold; color:#555;">Syarat Buka</label>
                <input type="text" value="${valRequired || ''}" class="chap-required" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">
            </div>
             <div>
                <label style="font-size:0.8rem; font-weight:bold; color:#2ecc71;">Game Goal</label>
                <input type="text" value="${valGoal || ''}" class="chap-goal" style="width:100%; padding:8px; border:1px solid #2ecc71; border-radius:4px;">
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

document.addEventListener('DOMContentLoaded', async () => {
    
    // VARIABEL
    const checkVN = document.getElementById('check-is-vn');
    const checkStory = document.getElementById('check-is-story');
    const btnTabVisual = document.getElementById('btn-tab-visual');
    const btnTabStory = document.getElementById('btn-tab-skenario');
    const bgUrlField = document.getElementById('vn-bg-url');

    // TOGGLE LISTENERS
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
        checkStory.addEventListener('change', (e) => {
            if (e.target.checked) {
                if(btnTabStory) { btnTabStory.classList.add('enabled'); btnTabStory.innerHTML = '3. Skenario (Story)'; }
                if (checkVN && !checkVN.checked) {
                    checkVN.checked = true;
                    checkVN.dispatchEvent(new Event('change'));
                }
            } else {
                if(btnTabStory) { btnTabStory.classList.remove('enabled'); btnTabStory.innerHTML = '🔒 3. Skenario (Story)'; }
            }
        });
    }

    // BG Upload
    const bgInput = document.getElementById('vn-bg-file');
    if(bgInput && bgUrlField) {
        bgInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if(!file) return;
            try {
                bgUrlField.value = "Uploading...";
                const token = await getAuthTokenSafe();
                const url = await uploadSingleImage(file, token);
                bgUrlField.value = url;
            } catch(e) { 
                showCustomAlert("Gagal", "Upload Background gagal!", "❌");
                bgUrlField.value = "";
            }
        });
    }

    // LOAD DATA
    const urlParams = new URLSearchParams(window.location.search);
    const charId = urlParams.get('id');

    if (!charId) {
        await showCustomAlert("Error", "ID Karakter tidak ditemukan.", "❓");
        window.location.href = 'index.html';
        return;
    }

    const statusMsg = document.getElementById('form-status');
    statusMsg.textContent = "Mengambil data...";

    try {
        const res = await fetch(`/.netlify/functions/get-character?id=${charId}`);
        if(res.status === 404) { 
            await showCustomAlert("Hilang", "Karakter tidak ditemukan atau sudah dihapus!", "👻");
            window.location.href='index.html'; 
            return; 
        }
        if(!res.ok) throw new Error("Gagal fetch.");
        
        currentData = await res.json();
        
        // POPULATE FORM
        document.getElementById('char-id').value = charId;
        document.getElementById('mai-name').value = currentData.name || "";
        document.getElementById('mai-greeting').value = currentData.greeting || "";
        document.getElementById('mai-tagline').value = currentData.tagline || "";
        document.getElementById('mai-description').value = currentData.description || "";
        document.getElementById('mai-tags').value = (currentData.tags || []).join(", ");
        document.getElementById('avatar-preview').src = currentData.image || "https://via.placeholder.com/150";

        if (currentData.visibility === 'private') {
            document.querySelector('input[name="visibility"][value="private"]').checked = true;
        } else {
            document.querySelector('input[name="visibility"][value="public"]').checked = true;
        }

        // Dual Tag Logic
        const hasStory = currentData.isStoryAvailable || (currentData.mode === 'story');
        const hasVisual = currentData.isVnAvailable || hasStory || (currentData.sprites && Object.keys(currentData.sprites).length > 0);

        if(hasVisual) { checkVN.checked = true; checkVN.dispatchEvent(new Event('change')); }
        if(hasStory) { checkStory.checked = true; checkStory.dispatchEvent(new Event('change')); }

        if(bgUrlField) bgUrlField.value = currentData.backgroundImage || "";
        
        if (currentData.sprites) {
            ['happy', 'sad', 'angry', 'shy', 'surprised'].forEach(emo => {
                if (currentData.sprites[emo]) {
                    const label = document.getElementById(`label-${emo}`);
                    if(label) {
                        label.innerHTML = `<span style="font-size:0.8rem; color:#28a745;">✅ Tersimpan</span>`;
                        label.style.borderColor = "#28a745";
                    }
                }
            });
        }

        // Chapters
        document.getElementById('mai-game-goal').value = currentData.gameGoal || "";
        const existingChapters = currentData.chapters || [];
        const container = document.getElementById('chapters-container');
        container.innerHTML = "";
        if (existingChapters.length > 0) existingChapters.forEach(c => window.addChapterInput(c));

        statusMsg.textContent = "";

    } catch (err) {
        console.error(err);
        statusMsg.textContent = "Gagal memuat data.";
    }


    // E. SUBMIT UPDATE
    const form = document.getElementById('edit-mai-form');
    const submitBtn = document.getElementById('submit-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let token;
        try { token = await getAuthTokenSafe(); } 
        catch(e) { await showCustomAlert("Akses", "Silakan login dulu!", "🛑"); return; }

        const isVn = checkVN.checked;
        const isStory = checkStory.checked;
        const bgUrl = bgUrlField.value;

        if (isVn && !bgUrl) {
            await showCustomAlert("Data Kurang", "Mode Visual aktif tapi Background kosong!", "🖼️");
            window.switchTab('tab-visual');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "⏳ Menyimpan...";
        statusMsg.textContent = "Mengupdate...";

        try {
            // Upload Avatar
            let finalImage = currentData.image;
            const mainFile = document.getElementById('mai-image').files[0];
            if (mainFile) finalImage = await uploadSingleImage(mainFile, token);

            // Upload Sprites
            const finalSprites = currentData.sprites || {};
            if (mainFile) finalSprites['idle'] = finalImage; 
            const emotions = ['happy', 'sad', 'angry', 'shy', 'surprised'];
            for (const emo of emotions) {
                const input = document.getElementById(`sprite-${emo}`);
                if (input && input.files[0]) {
                    statusMsg.textContent = `Upload ${emo}...`;
                    const url = await uploadSingleImage(input.files[0], token);
                    finalSprites[emo] = url;
                }
            }

            // Payload
            const chapters = getChaptersFromUI();
            const gameGoal = document.getElementById('mai-game-goal').value;

            const payload = {
                id: charId,
                name: document.getElementById('mai-name').value,
                greeting: document.getElementById('mai-greeting').value,
                tagline: document.getElementById('mai-tagline').value,
                description: document.getElementById('mai-description').value,
                tags: document.getElementById('mai-tags').value.split(',').map(t=>t.trim()).filter(t=>t),
                visibility: document.querySelector('input[name="visibility"]:checked').value,
                image: finalImage,
                isVnAvailable: isVn,
                isStoryAvailable: isStory,
                backgroundImage: isVn ? bgUrl : "",
                sprites: finalSprites,
                gameGoal: isStory ? gameGoal : "",
                chapters: isStory ? chapters : []
            };

            const res = await fetch('/.netlify/functions/update-mai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Gagal update.");

            await showCustomAlert("Berhasil", "Data karakter berhasil diperbarui!", "🎉");
            sessionStorage.removeItem('mai_chars_user');
            window.location.href = 'index.html';

        } catch (err) {
            console.error(err);
            statusMsg.textContent = "Gagal";
            await showCustomAlert("Error", err.message, "❌");
            submitBtn.disabled = false;
            submitBtn.textContent = "💾 Simpan Perubahan";
        }
    });

    // F. DELETE BUTTON
    const btnDel = document.getElementById('btn-delete-char');
    if (btnDel) {
        btnDel.addEventListener('click', async () => {
            const confirmed = await showCustomConfirm(
                "Hapus Permanen?", 
                "Apakah Anda yakin ingin menghapus karakter ini? Data tidak bisa dikembalikan!", 
                "🗑️", 
                "HAPUS SEKARANG",
                true // isDanger
            );

            if(!confirmed) return;

            try {
                btnDel.textContent = "⏳ Menghapus...";
                const token = await getAuthTokenSafe();
                const res = await fetch('/.netlify/functions/delete-mai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ id: charId })
                });
                if(res.ok) {
                    sessionStorage.removeItem('mai_chars_user');
                    await showCustomAlert("Terhapus", "Karakter telah dihapus.", "👋");
                    window.location.href='index.html';
                } else { throw new Error("Gagal hapus"); }
            } catch(e) {
                await showCustomAlert("Gagal", e.message, "❌");
                btnDel.textContent = "🗑️ Hapus Karakter Ini Permanen";
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