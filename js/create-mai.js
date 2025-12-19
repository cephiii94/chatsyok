// File: js/create-mai.js
// VERSI: CHAPTER MANAGER (CREATE MODE)

// --- 1. HELPER FUNCTIONS ---

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

// Tab Switcher
window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabName).classList.add('active');
    
    // Cari tombol tab yang sesuai
    const btns = document.querySelectorAll('.tab-btn');
    if (tabName === 'tab-identitas') btns[0].classList.add('active');
    if (tabName === 'tab-visual') btns[1].classList.add('active');
    if (tabName === 'tab-skenario') btns[2].classList.add('active');
};

// UI File Name Update
window.updateFileName = function(input, labelId) {
    const label = document.getElementById(labelId);
    if (input.files && input.files[0]) {
        label.innerText = "✅ " + input.files[0].name;
        label.style.background = "#e6fffa";
        label.style.borderColor = "#2ecc71";
    }
};

// --- 2. CHAPTER MANAGER LOGIC (SAMA DENGAN EDIT) ---

window.addChapterInput = function() {
    const container = document.getElementById('chapters-container');
    const index = container.children.length + 1;
    
    const html = `
    <div class="chapter-item">
        <div style="margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">
            <strong>Chapter #${index}</strong>
            <button type="button" onclick="this.closest('.chapter-item').remove()" style="float:right; color:red; border:none; background:none; cursor:pointer;">Hapus</button>
        </div>
        
        <div style="display:grid; grid-template-columns: 1fr 2fr; gap:10px;">
            <div>
                <label style="font-size:0.8rem; font-weight:bold; color:#555;">ID Unik</label>
                <input type="text" class="chap-id" value="chap${index}" style="width:100%; padding:5px; border:1px solid #ccc;">
            </div>
            <div>
                <label style="font-size:0.8rem; font-weight:bold; color:#555;">Judul</label>
                <input type="text" class="chap-title" placeholder="Judul Bab" style="width:100%; padding:5px; border:1px solid #ccc;">
            </div>
        </div>

        <div style="margin-top:10px;">
            <label style="font-size:0.8rem; font-weight:bold; color:#555;">Deskripsi Singkat</label>
            <textarea class="chap-desc" rows="2" style="width:100%; padding:5px; border:1px solid #ccc;"></textarea>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
            <div>
                <label style="font-size:0.8rem; font-weight:bold; color:#555;">Required ID</label>
                <input type="text" class="chap-required" placeholder="Syarat ID sebelumnya" style="width:100%; padding:5px; border:1px solid #ccc;">
            </div>
            <div>
                <label style="font-size:0.8rem; font-weight:bold; color:#2ecc71;">Game Goal</label>
                <input type="text" class="chap-goal" placeholder="Misi..." style="width:100%; padding:5px; border:1px solid #2ecc71;">
            </div>
        </div>
    </div>
    `;
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

        if(id && title) {
            chapters.push({ id, title, desc, required, gameGoal });
        }
    });
    return chapters;
}

// --- 3. MAIN SUBMIT LOGIC ---

document.addEventListener('DOMContentLoaded', () => {
    // Tambahkan 1 chapter kosong saat awal
    addChapterInput();

    const form = document.getElementById('create-mai-form');
    const statusMsg = document.getElementById('form-status');
    const submitBtn = document.getElementById('submit-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let token;
        try { token = await getAuthTokenSafe(); } 
        catch (err) { statusMsg.textContent = "Silakan login dulu."; return; }

        submitBtn.disabled = true;
        submitBtn.textContent = "Sedang Membuat...";
        statusMsg.textContent = "Mengupload data...";
        statusMsg.style.color = "blue";

        try {
            // 1. Upload Avatar Utama
            let imageUrl = null;
            const mainFile = document.getElementById('mai-image').files[0];
            if (mainFile) {
                statusMsg.textContent = "Upload avatar utama...";
                imageUrl = await uploadSingleImage(mainFile, token);
            }

            // 2. Upload Sprites
            const sprites = {};
            if(imageUrl) sprites['idle'] = imageUrl; // Default idle

            const emotions = ['happy', 'sad', 'angry', 'shy', 'surprised'];
            for (const emo of emotions) {
                const input = document.getElementById(`sprite-${emo}`);
                if (input && input.files[0]) {
                    statusMsg.textContent = `Upload sprite: ${emo}...`;
                    const url = await uploadSingleImage(input.files[0], token);
                    sprites[emo] = url;
                }
            }

            // 3. Ambil Chapters
            const chapters = getChaptersFromUI();

            // 4. Hitung Mode
            const isVnChecked = document.getElementById('mai-is-vn').checked;
            const finalMode = (chapters.length > 0) ? 'story' : 'free';

            // 5. Susun Data
            const payload = {
                name: document.getElementById('mai-name').value,
                greeting: document.getElementById('mai-greeting').value,
                tagline: document.getElementById('mai-tagline').value,
                description: document.getElementById('mai-description').value,
                tags: document.getElementById('mai-tags').value.split(',').map(t => t.trim()).filter(t=>t),
                visibility: document.querySelector('input[name="visibility"]:checked').value,
                
                image: imageUrl,
                sprites: sprites,

                mode: finalMode,
                isVnAvailable: isVnChecked || (chapters.length > 0),
                gameGoal: document.getElementById('mai-game-goal').value,
                
                chapters: chapters // Kirim array chapter
            };

            // 6. Kirim ke Backend Save
            const res = await fetch('/.netlify/functions/save-mai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Gagal menyimpan.");

            statusMsg.textContent = "🎉 Karakter Berhasil Dibuat!";
            statusMsg.style.color = "green";
            
            // Clear Cache
            sessionStorage.removeItem('mai_chars_user');
            
            setTimeout(() => { window.location.href = 'index.html'; }, 1500);

        } catch (err) {
            console.error(err);
            statusMsg.textContent = "Error: " + err.message;
            statusMsg.style.color = "red";
            submitBtn.disabled = false;
            submitBtn.textContent = "Coba Lagi";
        }
    });
});