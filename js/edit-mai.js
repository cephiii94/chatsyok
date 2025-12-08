// File: js/edit-mai.js
// Versi: Edit Multi-Sprite + Admin Check + UI Toggle

function getAuthTokenSafe() {
    return new Promise((resolve, reject) => {
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

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const charId = params.get('id');

    if (!charId) {
        alert("ID Karakter tidak ditemukan.");
        window.location.href = 'index.html';
        return;
    }

    // Elemen VN Toggle
    const vnCheckbox = document.getElementById('mai-is-vn');
    const vnSpritesGrid = document.getElementById('vn-sprites-grid'); // ID di edit.html beda dikit (grid)

    // Fungsi Toggle UI
    const toggleVnSprites = () => {
        if (vnCheckbox && vnSpritesGrid) {
            vnSpritesGrid.style.display = vnCheckbox.checked ? 'grid' : 'none';
        }
    };
    if(vnCheckbox) vnCheckbox.addEventListener('change', toggleVnSprites);

    // --- CEK ADMIN (Tampilkan Container Utama VN jika admin) ---
    const auth = firebase.auth();
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const tokenResult = await user.getIdTokenResult();
                if (tokenResult.claims.admin) {
                    const vnContainer = document.getElementById('vn-section-container');
                    if (vnContainer) vnContainer.style.display = 'block';
                }
            } catch (e) { console.error("Gagal cek admin:", e); }
        }
    });

    // --- Load Data Lama ---
    try {
        const response = await fetch(`/.netlify/functions/get-character?id=${charId}`);
        if (!response.ok) throw new Error("Gagal mengambil data.");
        
        const data = await response.json();

        // Isi form dasar
        document.getElementById('mai-id').value = charId;
        document.getElementById('mai-name').value = data.name;
        document.getElementById('mai-greeting').value = data.greeting;
        document.getElementById('mai-tagline').value = data.tagline || '';
        document.getElementById('mai-description').value = data.description;
        document.getElementById('mai-tags').value = (data.tags || []).join(', ');
        
        // Load Status VN & Update Toggle UI
        if(vnCheckbox) {
            vnCheckbox.checked = data.isVnAvailable === true;
            toggleVnSprites(); // Update tampilan grid sesuai data
        }

        // Avatar Utama
        document.getElementById('avatar-preview').src = data.image;
        document.getElementById('current-image-url').value = data.image;

        if (data.visibility === 'private') document.getElementById('vis-private').checked = true;
        else document.getElementById('vis-public').checked = true;

        // Load Sprites
        const emotions = ['happy', 'sad', 'angry', 'shy', 'surprised'];
        const existingSprites = data.sprites || {};

        emotions.forEach(emo => {
            const previewEl = document.getElementById(`preview-${emo}`);
            const hiddenEl = document.getElementById(`current-${emo}-url`);
            
            if (existingSprites[emo]) {
                previewEl.src = existingSprites[emo];
                hiddenEl.value = existingSprites[emo];
            } else {
                previewEl.src = "https://via.placeholder.com/100?text=Empty";
                hiddenEl.value = ""; 
            }
        });

    } catch (error) {
        console.error(error);
        alert("Gagal memuat data karakter.");
    }

    // --- Handle Image Preview ---
    const imageInput = document.getElementById('mai-image');
    imageInput.addEventListener('change', () => {
        const file = imageInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => { document.getElementById('avatar-preview').src = e.target.result; }
            reader.readAsDataURL(file);
        }
    });

    // --- Handle Submit ---
    document.getElementById('edit-mai-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('submit-btn');
        const statusMsg = document.getElementById('form-status');
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Menyimpan...';
        statusMsg.textContent = 'Memproses...';
        statusMsg.className = '';

        try {
            const token = await getAuthTokenSafe();
            
            // 1. Avatar Utama
            let imageUrl = document.getElementById('current-image-url').value;
            const mainFile = imageInput.files[0];
            if (mainFile) {
                statusMsg.textContent = 'Meng-upload avatar utama...';
                imageUrl = await uploadSingleImage(mainFile, token);
            }

            // 2. Sprites (Cek upload baru atau pakai lama)
            const sprites = {};
            const emotions = ['happy', 'sad', 'angry', 'shy', 'surprised'];
            
            sprites['idle'] = imageUrl; // Update idle jika avatar utama berubah

            // Hanya proses sprite jika checkbox dicentang
            if (vnCheckbox && vnCheckbox.checked) {
                for (const emo of emotions) {
                    const spriteInput = document.getElementById(`sprite-${emo}`);
                    const currentUrl = document.getElementById(`current-${emo}-url`).value;

                    if (spriteInput.files[0]) {
                        statusMsg.textContent = `Meng-upload sprite: ${emo}...`;
                        const newUrl = await uploadSingleImage(spriteInput.files[0], token);
                        sprites[emo] = newUrl;
                    } else if (currentUrl) {
                        sprites[emo] = currentUrl;
                    }
                }
            }

            // 3. Update Data
            statusMsg.textContent = 'Menyimpan perubahan...';
            const payload = {
                id: charId,
                name: document.getElementById('mai-name').value,
                greeting: document.getElementById('mai-greeting').value,
                tagline: document.getElementById('mai-tagline').value,
                description: document.getElementById('mai-description').value,
                tags: document.getElementById('mai-tags').value.split(',').map(t => t.trim()).filter(t => t),
                visibility: document.querySelector('input[name="visibility"]:checked').value,
                isVnAvailable: vnCheckbox ? vnCheckbox.checked : false,
                image: imageUrl,
                sprites: sprites
            };

            const updateRes = await fetch('/.netlify/functions/update-mai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (!updateRes.ok) {
                const err = await updateRes.json();
                throw new Error(err.error || "Gagal update.");
            }

            statusMsg.textContent = "Berhasil! Kembali ke chat...";
            statusMsg.className = "success";
            
            sessionStorage.removeItem('mai_chars_user'); 

            setTimeout(() => {
                window.location.href = `chat.html?id=${charId}`;
            }, 1500);

        } catch (error) {
            console.error(error);
            statusMsg.textContent = `Error: ${error.message}`;
            statusMsg.className = "error";
            submitBtn.disabled = false;
            submitBtn.textContent = 'Simpan Perubahan';
        }
    });

    document.getElementById('cancel-btn').addEventListener('click', () => {
        window.location.href = `chat.html?id=${charId}`;
    });
});