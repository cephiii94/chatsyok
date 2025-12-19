// File: js/edit-mai.js
// VERSI: FINAL FULL FEATURES (Chapter Manager, Quick Upload, Delete, 404 Check)

let currentData = {};

// ==========================================
// 1. HELPER & UI FUNCTIONS
// ==========================================

function getAuthTokenSafe() {
    return new Promise((resolve, reject) => {
        if (!firebase.apps.length) return reject(new Error("Firebase belum init"));
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
    const base64 = await readFileAsBase64(file);
    const res = await fetch('/.netlify/functions/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ file: base64 })
    });
    if (!res.ok) throw new Error("Gagal upload gambar.");
    const data = await res.json();
    return data.secure_url;
}

window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    const targetTab = document.getElementById(tabName);
    if(targetTab) targetTab.classList.add('active');

    // Aktifkan tombol yang sesuai
    const btns = document.querySelectorAll('.tab-btn');
    if(tabName === 'tab-identitas') btns[0]?.classList.add('active');
    if(tabName === 'tab-visual') btns[1]?.classList.add('active');
    if(tabName === 'tab-skenario') btns[2]?.classList.add('active');
};

window.updateFileName = function(input, labelId) {
    const label = document.getElementById(labelId);
    if (!label) return;
    if (input.files && input.files[0]) {
        let fileName = input.files[0].name;
        if (fileName.length > 15) fileName = fileName.substring(0, 12) + "...";
        
        // Cek tipe label (Sprite box atau tombol biasa)
        if (label.classList.contains('sprite-label')) {
            label.innerText = "✅ " + fileName;
            label.style.borderColor = "#28a745";
            label.style.color = "#28a745";
        } else {
            label.innerText = "✅ " + fileName;
            label.style.background = "#e6fffa";
            label.style.borderColor = "#28a745";
        }
    }
};

// ==========================================
// [BARU] LOGIKA CHAPTER MANAGER UI
// ==========================================

window.addChapterInput = function(data = null) {
    const container = document.getElementById('chapters-container');
    const index = container.children.length + 1; 
    
    // Default Values
    const valId = data ? data.id : `chap${index}`;
    const valTitle = data ? data.title : `Bab ${index}: Judul Bab`;
    const valDesc = data ? data.desc : "";       
    const valRequired = data ? data.required : ""; 
    const valGoal = data ? data.gameGoal : "";     

    const btnRemove = `<button type="button" onclick="this.closest('.chapter-item').remove()" style="float:right; color:#ff6b6b; background:none; border:none; cursor:pointer; font-weight:bold;">🗑️ Hapus</button>`;

    const html = `
    <div class="chapter-item">
        <div style="margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
            <strong style="font-size:1.1rem; color:#333;">Chapter #${index}</strong>
            ${btnRemove}
        </div>

        <div style="display:grid; grid-template-columns: 1fr 2fr; gap:15px; margin-bottom:15px;">
            <div>
                <label style="display:block; font-size:0.8rem; font-weight:bold; color:#555; margin-bottom:5px;">ID Unik (Wajib)</label>
                <input type="text" value="${valId}" class="chap-id" placeholder="contoh: chap1" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; background:#f9f9f9;">
            </div>
            <div>
                <label style="display:block; font-size:0.8rem; font-weight:bold; color:#555; margin-bottom:5px;">Judul Chapter</label>
                <input type="text" value="${valTitle}" class="chap-title" placeholder="Judul yang tampil di kartu Lobby" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">
            </div>
        </div>
        
        <div style="margin-bottom:15px;">
            <label style="display:block; font-size:0.8rem; font-weight:bold; color:#555; margin-bottom:5px;">Deskripsi Singkat (Sinopsis)</label>
            <textarea class="chap-desc" rows="2" placeholder="Muncul di bawah judul di Lobby..." style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">${valDesc}</textarea>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
            <div>
                <label style="display:block; font-size:0.8rem; font-weight:bold; color:#555; margin-bottom:5px;">Syarat Buka (Required ID)</label>
                <input type="text" value="${valRequired || ''}" class="chap-required" placeholder="Kosongkan jika bab 1" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">
            </div>
             <div>
                <label style="display:block; font-size:0.8rem; font-weight:bold; color:#2ecc71; margin-bottom:5px;">Game Goal (Misi)</label>
                <input type="text" value="${valGoal || ''}" class="chap-goal" placeholder="Contoh: Buat dia tertawa" style="width:100%; padding:8px; border:1px solid #2ecc71; border-radius:4px;">
            </div>
        </div>
    </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
};

// Fungsi ambil data dari Form UI
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

        if(id && title) {
            chapters.push({ id, title, desc, required, gameGoal });
        }
    });
    return chapters;
}


// ==========================================
// 2. MAIN LOGIC (Fetch, Update, Delete)
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    // A. Ambil ID dari URL
    const urlParams = new URLSearchParams(window.location.search);
    const charId = urlParams.get('id');

    if (!charId) {
        alert("ID Karakter tidak ditemukan!");
        window.location.href = 'index.html';
        return;
    }

    const form = document.getElementById('edit-mai-form');
    const statusMsg = document.getElementById('form-status');
    const submitBtn = document.getElementById('submit-btn');

    // === QUICK ASSET UPLOADER LOGIC ===
    const quickInput = document.getElementById('quick-asset-input');
    const quickStatus = document.getElementById('quick-upload-status');
    const quickResultBox = document.getElementById('quick-upload-result');
    const quickUrlInput = document.getElementById('quick-asset-url');
    const btnCopy = document.getElementById('btn-copy-asset');

    if (quickInput) {
        quickInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            quickStatus.textContent = "Mengupload...";
            try {
                const token = await getAuthTokenSafe();
                const url = await uploadSingleImage(file, token);
                quickStatus.textContent = "✅ Selesai!";
                if(quickResultBox) quickResultBox.style.display = 'flex';
                if(quickUrlInput) quickUrlInput.value = url;
            } catch (err) {
                quickStatus.textContent = "❌ Error";
                console.error(err);
            }
        });
        if (btnCopy) {
            btnCopy.addEventListener('click', () => {
                quickUrlInput.select();
                document.execCommand('copy');
                const prev = btnCopy.textContent;
                btnCopy.textContent = "Copied!";
                setTimeout(() => btnCopy.textContent = prev, 1500);
            });
        }
    }
    // ==================================

    // C. FETCH DATA KARAKTER LAMA
    try {
        statusMsg.textContent = "Mengambil data...";
        const res = await fetch(`/.netlify/functions/get-character?id=${charId}`);
        
        // [ANTI-HANTU] Cek jika data sudah dihapus
        if (res.status === 404) {
            alert("⚠️ Karakter tidak ditemukan atau sudah dihapus!");
            window.location.href = 'index.html';
            return;
        }
        
        if(!res.ok) throw new Error("Gagal mengambil data");
        
        currentData = await res.json(); 
        
        // --- POPULATE IDENTITAS ---
        document.getElementById('char-id').value = charId;
        document.getElementById('mai-name').value = currentData.name || "";
        document.getElementById('mai-greeting').value = currentData.greeting || "";
        document.getElementById('mai-tagline').value = currentData.tagline || "";
        document.getElementById('mai-description').value = currentData.description || "";
        document.getElementById('mai-tags').value = (currentData.tags || []).join(", ");
        document.getElementById('mai-game-goal').value = currentData.gameGoal || "";

        if (currentData.visibility === 'private') {
            const rPrivate = document.querySelector('input[name="visibility"][value="private"]');
            if(rPrivate) rPrivate.checked = true;
        } else {
            const rPublic = document.querySelector('input[name="visibility"][value="public"]');
            if(rPublic) rPublic.checked = true;
        }

        if(currentData.image) document.getElementById('avatar-preview').src = currentData.image;

        // Populate Sprites
        if (currentData.sprites) {
            ['happy', 'sad', 'angry', 'shy', 'surprised'].forEach(emo => {
                if (currentData.sprites[emo]) {
                    const label = document.getElementById(`lbl-${emo}`); // Pastikan ID label sesuai HTML
                    if(label) {
                        label.innerHTML = "✅ Tersimpan";
                        label.style.borderColor = "#007bff";
                        label.style.color = "#007bff";
                    }
                }
            });
        }

        // --- POPULATE CHAPTERS ---
        const chaptersContainer = document.getElementById('chapters-container');
        chaptersContainer.innerHTML = ""; 
        
        const existingChapters = currentData.chapters || currentData.storyChapters || [];
        
        if (existingChapters.length > 0) {
            existingChapters.forEach(chap => {
                window.addChapterInput(chap); 
            });
        } else {
            window.addChapterInput({ id: 'chap1', title: 'Bab 1: Permulaan' });
        }

        statusMsg.textContent = "";

    } catch (error) {
        console.error(error);
        statusMsg.textContent = "Error loading data.";
    }


    // D. HANDLE UPDATE (SIMPAN)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let token;
        try { token = await getAuthTokenSafe(); } 
        catch (err) { statusMsg.textContent = "Silakan login ulang."; return; }

        submitBtn.disabled = true;
        submitBtn.textContent = "Menyimpan...";
        statusMsg.textContent = "Mengupdate data...";

        try {
            // 1. Upload Avatar
            let finalImageUrl = currentData.image;
            const mainFile = document.getElementById('mai-image').files[0];
            if (mainFile) finalImageUrl = await uploadSingleImage(mainFile, token);

            // 2. Upload Sprites
            const finalSprites = currentData.sprites || {};
            const emotions = ['happy', 'sad', 'angry', 'shy', 'surprised'];
            finalSprites['idle'] = finalImageUrl; 

            for (const emo of emotions) {
                const input = document.getElementById(`sprite-${emo}`);
                if (input && input.files[0]) {
                    statusMsg.textContent = `Upload sprite: ${emo}...`;
                    const newUrl = await uploadSingleImage(input.files[0], token);
                    finalSprites[emo] = newUrl;
                }
            }

            // 3. Ambil Data Chapters
            const chapters = getChaptersFromUI();
            
            // 4. Hitung Mode
            let finalMode = (chapters.length > 0) ? 'story' : 'free'; 

            // 5. Susun Payload
            const updateData = {
                id: charId, 
                name: document.getElementById('mai-name').value,
                greeting: document.getElementById('mai-greeting').value,
                tagline: document.getElementById('mai-tagline').value,
                description: document.getElementById('mai-description').value,
                tags: document.getElementById('mai-tags').value.split(',').map(t=>t.trim()).filter(t=>t),
                visibility: document.querySelector('input[name="visibility"]:checked').value,
                
                gameGoal: document.getElementById('mai-game-goal').value, 
                mode: finalMode,
                isVnAvailable: (chapters.length > 0),
                
                chapters: chapters, 
                image: finalImageUrl,
                sprites: finalSprites
            };

            // 6. Kirim ke Backend
            const res = await fetch('/.netlify/functions/update-mai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(updateData)
            });

            if(!res.ok) throw new Error("Gagal update.");

            statusMsg.textContent = "✅ Update Berhasil!";
            statusMsg.className = "success";
            
            // CLEAR CACHE
            sessionStorage.removeItem('mai_chars_user');
            
            setTimeout(() => { window.location.href = 'index.html'; }, 1000);

        } catch (error) {
            console.error(error);
            statusMsg.textContent = `Error: ${error.message}`;
            statusMsg.className = "error";
            submitBtn.disabled = false;
            submitBtn.textContent = "💾 Simpan Perubahan";
        }
    });

    // E. HANDLE DELETE (HAPUS KARAKTER)
    const btnDelete = document.getElementById('btn-delete-char');
    if (btnDelete) {
        btnDelete.addEventListener('click', async () => {
            const confirmName = prompt(`Ketik "HAPUS" untuk menghapus karakter ini permanen.`);
            if (confirmName !== "HAPUS") {
                alert("Batal menghapus.");
                return;
            }

            btnDelete.disabled = true;
            btnDelete.textContent = "Menghapus...";
            
            try {
                const token = await getAuthTokenSafe();
                const res = await fetch('/.netlify/functions/delete-mai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ id: charId })
                });

                if (!res.ok) throw new Error("Gagal menghapus.");

                // BERSIHKAN CACHE AGAR HANTU HILANG
                sessionStorage.removeItem('mai_chars_user'); 
                
                alert("Karakter berhasil dihapus!");
                window.location.href = 'index.html';

            } catch (error) {
                console.error(error);
                alert("Gagal menghapus: " + error.message);
                btnDelete.disabled = false;
                btnDelete.textContent = "🗑️ Hapus Karakter Ini Permanen";
            }
        });
    }
});