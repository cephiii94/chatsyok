// File: js/create-mai.js
// VERSI: FINAL HYBRID (Tabs + Light Mode + Modern Uploads)

// ==========================================
// 1. HELPER FUNCTIONS (Firebase & Upload)
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
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ file: base64 })
    });
    if (!res.ok) throw new Error("Gagal upload gambar.");
    const data = await res.json();
    return data.secure_url;
}

// ==========================================
// 2. GLOBAL UI FUNCTIONS (Attached to Window)
// ==========================================

// A. Logika Pindah Tab
window.switchTab = function(tabName) {
    // 1. Reset active state
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    // 2. Activate target
    const targetTab = document.getElementById(tabName);
    if(targetTab) targetTab.classList.add('active');

    // 3. Highlight button
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        if(btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabName)) {
            btn.classList.add('active');
        }
    });

    // 4. Auto-Check VN Mode
    const vnCheck = document.getElementById('mai-is-vn');
    if (tabName === 'tab-visual' || tabName === 'tab-skenario') {
        if(vnCheck) vnCheck.checked = true;
    }
};

// B. Update UI Saat File Dipilih (MODERN UPLOAD BUTTON)
window.updateFileName = function(input, labelId) {
    const label = document.getElementById(labelId);
    if (!label) return;

    if (input.files && input.files[0]) {
        // Ambil nama file, potong jika kepanjangan
        let fileName = input.files[0].name;
        if (fileName.length > 15) fileName = fileName.substring(0, 12) + "...";
        
        // Update Teks Label
        if (label.classList.contains('sprite-upload-box')) {
            // Style Kotak (Visual Tab)
            label.classList.add('has-file');
            label.innerHTML = `<div class="icon">✅</div><span>${fileName}</span>`;
            label.style.borderColor = "#28a745";
            label.style.background = "#e6fffa";
        } else {
            // Style Tombol (Identitas Tab)
            label.innerHTML = `✅ ${fileName}`;
            label.style.borderColor = "#28a745";
            label.style.color = "#28a745";
            label.style.background = "#e6fffa";
        }
    } else {
        // Reset jika cancel
        if (label.classList.contains('sprite-upload-box')) {
            label.classList.remove('has-file');
            label.innerHTML = `<div class="icon">📤</div><span>Upload</span>`;
            label.style.borderColor = "#dee2e6";
            label.style.background = "#ffffff";
        } else {
            label.innerHTML = `📁 Pilih Foto Profil`;
            label.style.borderColor = "#ced4da";
            label.style.color = "#333";
            label.style.background = "#ffffff";
        }
    }
};

// C. Tambah Input Chapter (LIGHT MODE FIXED)
window.addChapterInput = function() {
    const container = document.getElementById('chapters-container');
    const index = container.children.length; 
    
    // Perhatikan: Background #f8f9fa (Putih Abu), Text #333 (Hitam)
    const html = `
    <div class="chapter-item" id="chapter-${index}" style="background:#f8f9fa; padding:15px; margin-bottom:15px; border-left: 4px solid #007bff; border: 1px solid #eee; border-radius: 6px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <strong style="color:#333;">Chapter ${index + 1}</strong>
            ${index > 0 ? `<button type="button" onclick="removeChapter(${index})" style="color:#dc3545; background:none; border:none; cursor:pointer; font-size:0.9rem; font-weight:bold;">Hapus 🗑️</button>` : ''}
        </div>

        <div style="margin-bottom:10px;">
            <label style="color:#555; font-size:0.85rem; font-weight:500;">Judul Chapter</label>
            <input type="text" placeholder="Cth: Pertemuan Pertama" class="input-field story-title" style="width:100%; padding:8px; border:1px solid #ced4da; border-radius:4px; margin-top:5px; background:white; color:#333;">
        </div>
        
        <div style="margin-bottom:10px;">
            <label style="color:#555; font-size:0.85rem; font-weight:500;">Situasi / Context (PENTING)</label>
            <textarea placeholder="Jelaskan situasi awal. Cth: Hujan deras di stasiun tua, User sedang berteduh sendirian..." class="input-field story-context" rows="3" style="width:100%; padding:8px; border:1px solid #ced4da; border-radius:4px; margin-top:5px; background:white; color:#333;"></textarea>
        </div>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
            <div>
                <label style="color:#555; font-size:0.85rem; font-weight:500;">Goal AI</label>
                <input type="text" placeholder="Cth: Buat user penasaran" class="input-field story-goal" style="width:100%; padding:8px; border:1px solid #ced4da; border-radius:4px; margin-top:5px; background:white; color:#333;">
            </div>
            <div>
                <label style="color:#555; font-size:0.85rem; font-weight:500;">Trigger Lanjut</label>
                <input type="text" placeholder="Cth: User bertanya nama" class="input-field story-end" style="width:100%; padding:8px; border:1px solid #ced4da; border-radius:4px; margin-top:5px; background:white; color:#333;">
            </div>
        </div>
    </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
};

// D. Hapus Chapter
window.removeChapter = function(index) {
    const item = document.getElementById(`chapter-${index}`);
    if (item) item.remove();
};

// E. Ambil Data Story
function getStoryChapters() {
    const items = document.querySelectorAll('.chapter-item');
    let chapters = [];

    items.forEach((item, idx) => {
        const title = item.querySelector('.story-title').value.trim();
        const context = item.querySelector('.story-context').value.trim();
        const goal = item.querySelector('.story-goal').value.trim();
        const endCondition = item.querySelector('.story-end').value.trim();

        if(title || context) {
            chapters.push({
                id: idx,
                title: title || `Chapter ${idx+1}`,
                context: context || "Context tidak didefinisikan.",
                goal: goal || "Bertahan hidup.",
                endCondition: endCondition || "Percakapan selesai."
            });
        }
    });
    return chapters;
}


// ==========================================
// 3. MAIN LOGIC (DOM Content Loaded)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('create-mai-form');
    const mainImageInput = document.getElementById('mai-image');
    const avatarPreview = document.getElementById('avatar-preview');
    const submitButton = document.getElementById('submit-btn');
    const formStatus = document.getElementById('form-status');
    const vnCheckbox = document.getElementById('mai-is-vn'); // Hidden checkbox

    // 1. Auth Check
    const auth = firebase.auth();
    auth.onAuthStateChanged(async (user) => {
        if (!user) window.location.href = 'login.html';
    });

    // 2. Preview Avatar Utama (Fallback jika onchange di HTML gagal)
    if (mainImageInput) {
        mainImageInput.addEventListener('change', () => {
            const file = mainImageInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => { 
                    if(avatarPreview) avatarPreview.src = e.target.result; 
                }
                reader.readAsDataURL(file);
            }
        });
    }

    // 3. HANDLE SUBMIT
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            let token;
            try {
                token = await getAuthTokenSafe();
            } catch (error) {
                formStatus.textContent = 'Sesi habis. Silakan login kembali.';
                formStatus.className = 'error';
                return;
            }

            // Loading UI
            submitButton.disabled = true;
            submitButton.innerHTML = '⏳ Sedang Memproses...';
            formStatus.textContent = 'Mengupload data...';
            formStatus.className = '';

            try {
                // A. Upload Avatar Utama
                const mainFile = mainImageInput.files[0];
                if (!mainFile) throw new Error("Avatar utama wajib diisi!");
                const mainImageUrl = await uploadSingleImage(mainFile, token);

                // B. Upload Sprites
                const sprites = {};
                const emotions = ['happy', 'sad', 'angry', 'shy', 'surprised'];
                sprites['idle'] = mainImageUrl; 

                const isVnActive = vnCheckbox ? vnCheckbox.checked : false;

                if (isVnActive) {
                    for (const emo of emotions) {
                        const input = document.getElementById(`sprite-${emo}`);
                        if (input && input.files[0]) {
                            formStatus.textContent = `Upload ekspresi: ${emo}...`;
                            const url = await uploadSingleImage(input.files[0], token);
                            sprites[emo] = url;
                        }
                    }
                }

                // C. Mode & Story
                const storyChapters = getStoryChapters();
                let finalMode = 'free';

                if (storyChapters.length > 0) {
                    finalMode = 'story';
                } else if (isVnActive) {
                    finalMode = 'free'; 
                }

                // D. Payload
                const maiData = {
                    name: document.getElementById('mai-name').value,
                    greeting: document.getElementById('mai-greeting').value,
                    tagline: document.getElementById('mai-tagline').value,
                    description: document.getElementById('mai-description').value,
                    tags: document.getElementById('mai-tags').value.split(',').map(t => t.trim()).filter(t => t),
                    visibility: document.querySelector('input[name="visibility"]:checked').value,
                    
                    isVnAvailable: isVnActive || (storyChapters.length > 0),
                    mode: finalMode,
                    gameGoal: document.getElementById('mai-game-goal') ? document.getElementById('mai-game-goal').value : '',
                    storyChapters: storyChapters,
                    
                    image: mainImageUrl,
                    sprites: sprites 
                };

                // E. Kirim Backend
                formStatus.textContent = 'Menyimpan ke database...';
                const saveRes = await fetch('/.netlify/functions/save-mai', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(maiData)
                });

                if (!saveRes.ok) throw new Error("Gagal menyimpan data.");

                sessionStorage.removeItem('mai_chars_user');
                formStatus.textContent = '✅ Berhasil! Mengalihkan...';
                formStatus.className = 'success';
                
                setTimeout(() => { window.location.href = 'index.html'; }, 1500);

            } catch (error) {
                console.error(error);
                formStatus.textContent = `❌ Error: ${error.message}`;
                formStatus.className = 'error';
                submitButton.disabled = false;
                submitButton.textContent = '✨ Buat Karakter Sekarang';
            }
        });
    }
});