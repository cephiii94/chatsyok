// File: js/edit-mai.js
// VERSI: FULL HYBRID EDIT (Populate + Update)

// Global variable untuk menyimpan data lama (terutama URL gambar)
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

// LOGIKA UI (Sama seperti create-mai)
window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    const targetTab = document.getElementById(tabName);
    if(targetTab) targetTab.classList.add('active');

    document.querySelectorAll('.tab-btn').forEach(btn => {
        if(btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabName)) {
            btn.classList.add('active');
        }
    });
};

window.updateFileName = function(input, labelId) {
    const label = document.getElementById(labelId);
    if (!label) return;
    if (input.files && input.files[0]) {
        let fileName = input.files[0].name;
        if (fileName.length > 15) fileName = fileName.substring(0, 12) + "...";
        
        if (label.classList.contains('sprite-upload-box')) {
            label.classList.add('has-file');
            label.innerHTML = `<div class="icon">✅</div><span>${fileName}</span>`;
            label.style.borderColor = "#28a745";
            label.style.background = "#e6fffa";
        } else {
            label.innerHTML = `✅ ${fileName}`;
            label.style.borderColor = "#28a745";
            label.style.color = "#28a745";
            label.style.background = "#e6fffa";
        }
    }
};

// --- LOGIKA CHAPTER BUILDER (Versi Populate) ---
// Kita tambahkan parameter opsional 'data' untuk mengisi nilai awal
window.addChapterInput = function(data = null) {
    const container = document.getElementById('chapters-container');
    const index = container.children.length; 
    
    // Default value kalau kosong
    const valTitle = data ? data.title : "";
    const valContext = data ? data.context : "";
    const valGoal = data ? data.goal : "";
    const valEnd = data ? data.endCondition : "";

    const html = `
    <div class="chapter-item" id="chapter-${index}" style="background:#f8f9fa; padding:15px; margin-bottom:15px; border-left: 4px solid #007bff; border: 1px solid #eee; border-radius: 6px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <strong style="color:#333;">Chapter ${index + 1}</strong>
            ${index > 0 ? `<button type="button" onclick="removeChapter(${index})" style="color:#dc3545; background:none; border:none; cursor:pointer; font-size:0.9rem; font-weight:bold;">Hapus 🗑️</button>` : ''}
        </div>

        <div style="margin-bottom:10px;">
            <label style="color:#555; font-size:0.85rem; font-weight:500;">Judul Chapter</label>
            <input type="text" value="${valTitle}" class="input-field story-title" style="width:100%; padding:8px; border:1px solid #ced4da; border-radius:4px; margin-top:5px; background:white; color:#333;">
        </div>
        
        <div style="margin-bottom:10px;">
            <label style="color:#555; font-size:0.85rem; font-weight:500;">Situasi / Context</label>
            <textarea class="input-field story-context" rows="3" style="width:100%; padding:8px; border:1px solid #ced4da; border-radius:4px; margin-top:5px; background:white; color:#333;">${valContext}</textarea>
        </div>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
            <div>
                <label style="color:#555; font-size:0.85rem; font-weight:500;">Goal AI</label>
                <input type="text" value="${valGoal}" class="input-field story-goal" style="width:100%; padding:8px; border:1px solid #ced4da; border-radius:4px; margin-top:5px; background:white; color:#333;">
            </div>
            <div>
                <label style="color:#555; font-size:0.85rem; font-weight:500;">Trigger Lanjut</label>
                <input type="text" value="${valEnd}" class="input-field story-end" style="width:100%; padding:8px; border:1px solid #ced4da; border-radius:4px; margin-top:5px; background:white; color:#333;">
            </div>
        </div>
    </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
};

window.removeChapter = function(index) {
    const item = document.getElementById(`chapter-${index}`);
    if (item) item.remove();
};

function getStoryChaptersFromUI() {
    const items = document.querySelectorAll('.chapter-item');
    let chapters = [];
    items.forEach((item, idx) => {
        const title = item.querySelector('.story-title').value.trim();
        const context = item.querySelector('.story-context').value.trim();
        const goal = item.querySelector('.story-goal').value.trim();
        const endCondition = item.querySelector('.story-end').value.trim();
        if(title || context) {
            chapters.push({ id: idx, title, context, goal, endCondition });
        }
    });
    return chapters;
}


// ==========================================
// 2. MAIN LOGIC (Fetch Data & Update)
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

    // B. Setup Elements
    const form = document.getElementById('edit-mai-form');
    const statusMsg = document.getElementById('form-status');
    const submitBtn = document.getElementById('submit-btn');

    // C. FETCH DATA KARAKTER LAMA
    try {
        statusMsg.textContent = "Mengambil data...";
        // Kita fetch langsung dari API get-character
        const res = await fetch(`/.netlify/functions/get-character?id=${charId}`);
        if(!res.ok) throw new Error("Gagal mengambil data");
        
        currentData = await res.json(); // Simpan di global var
        
        // --- POPULATE FORM ---
        document.getElementById('char-id').value = charId;
        document.getElementById('mai-name').value = currentData.name || "";
        document.getElementById('mai-greeting').value = currentData.greeting || "";
        document.getElementById('mai-tagline').value = currentData.tagline || "";
        document.getElementById('mai-description').value = currentData.description || "";
        document.getElementById('mai-tags').value = (currentData.tags || []).join(", ");
        document.getElementById('mai-game-goal').value = currentData.gameGoal || "";

        // Visibility
        if (currentData.visibility === 'private') {
            document.getElementById('vis-private').checked = true;
        } else {
            document.getElementById('vis-public').checked = true;
        }

        // Avatar Preview
        if(currentData.image) {
            document.getElementById('avatar-preview').src = currentData.image;
        }

        // Checkbox VN
        if (currentData.isVnAvailable) {
            document.getElementById('mai-is-vn').checked = true;
        }

        // Sprites: Tandai kotak jika sudah ada gambar (User interface feedback)
        if (currentData.sprites) {
            ['happy', 'sad', 'angry', 'shy', 'surprised'].forEach(emo => {
                if (currentData.sprites[emo]) {
                    const label = document.getElementById(`label-${emo}`);
                    if(label) {
                        label.innerHTML = `<div class="icon">🖼️</div><span>(Tersimpan)</span>`;
                        label.style.borderColor = "#007bff"; 
                    }
                }
            });
        }

        // STORY CHAPTERS: Loop dan bangun UI
        const chaptersContainer = document.getElementById('chapters-container');
        chaptersContainer.innerHTML = ""; // Bersihkan
        
        if (currentData.storyChapters && currentData.storyChapters.length > 0) {
            currentData.storyChapters.forEach(chap => {
                window.addChapterInput(chap); // Panggil fungsi dengan data
            });
        } else {
            // Kalau belum ada chapter, jangan tambah apa-apa (biar bersih)
        }

        statusMsg.textContent = "";

    } catch (error) {
        console.error(error);
        statusMsg.textContent = "Error loading data.";
    }


    // D. HANDLE UPDATE (SUBMIT)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let token;
        try { token = await getAuthTokenSafe(); } 
        catch (err) { statusMsg.textContent = "Silakan login ulang."; return; }

        submitBtn.disabled = true;
        submitBtn.textContent = "Menyimpan...";
        statusMsg.textContent = "Mengupdate data...";

        try {
            // 1. Upload Gambar (Hanya jika user memilih file baru)
            // Kalau input kosong, pakai URL lama dari currentData
            
            // Avatar Utama
            let finalImageUrl = currentData.image;
            const mainFile = document.getElementById('mai-image').files[0];
            if (mainFile) {
                statusMsg.textContent = "Upload avatar baru...";
                finalImageUrl = await uploadSingleImage(mainFile, token);
            }

            // Sprites
            const finalSprites = currentData.sprites || {};
            const emotions = ['happy', 'sad', 'angry', 'shy', 'surprised'];
            
            // Default Idle = Avatar Utama
            finalSprites['idle'] = finalImageUrl;

            for (const emo of emotions) {
                const input = document.getElementById(`sprite-${emo}`);
                if (input && input.files[0]) {
                    statusMsg.textContent = `Upload sprite: ${emo}...`;
                    const newUrl = await uploadSingleImage(input.files[0], token);
                    finalSprites[emo] = newUrl;
                }
            }

            // 2. Ambil Data Story Baru
            const storyChapters = getStoryChaptersFromUI();
            
            // 3. Tentukan Mode
            let finalMode = 'free';
            const isVnChecked = document.getElementById('mai-is-vn').checked;
            
            if (storyChapters.length > 0) finalMode = 'story';
            else if (isVnChecked) finalMode = 'free';

            // 4. Susun Payload
            const updateData = {
                id: charId, // PENTING: ID untuk update
                name: document.getElementById('mai-name').value,
                greeting: document.getElementById('mai-greeting').value,
                tagline: document.getElementById('mai-tagline').value,
                description: document.getElementById('mai-description').value,
                tags: document.getElementById('mai-tags').value.split(',').map(t=>t.trim()).filter(t=>t),
                visibility: document.querySelector('input[name="visibility"]:checked').value,
                
                gameGoal: document.getElementById('mai-game-goal').value,
                mode: finalMode,
                isVnAvailable: isVnChecked || (storyChapters.length > 0),
                storyChapters: storyChapters,

                image: finalImageUrl,
                sprites: finalSprites
            };

            // 5. Kirim ke Backend (Update)
            const res = await fetch('/.netlify/functions/update-mai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(updateData)
            });

            if(!res.ok) throw new Error("Gagal update.");

            statusMsg.textContent = "✅ Update Berhasil!";
            statusMsg.className = "success";
            
            // Refresh cache & redirect
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
});