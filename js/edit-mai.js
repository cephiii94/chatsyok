// File: js/edit-mai.js

// === HELPER FUNCTIONS ===
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

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('edit-mai-form');
    const submitButton = document.getElementById('submit-btn');
    const deleteButton = document.getElementById('delete-btn');
    const formStatus = document.getElementById('form-status');
    
    // UI Elements
    const maiIdInput = document.getElementById('mai-id');
    const nameInput = document.getElementById('mai-name');
    const greetingInput = document.getElementById('mai-greeting');
    const taglineInput = document.getElementById('mai-tagline');
    const descInput = document.getElementById('mai-description');
    const tagsInput = document.getElementById('mai-tags');
    const avatarPreview = document.getElementById('avatar-preview');
    const mainImageInput = document.getElementById('mai-image');
    
    // VN Elements
    const vnCheckbox = document.getElementById('mai-is-vn');
    const vnSpritesContainer = document.getElementById('vn-sprites-container');
    const vnGoalContainer = document.getElementById('vn-goal-container'); // [BRI UPDATE]
    const gameGoalInput = document.getElementById('mai-game-goal'); // [BRI UPDATE]

    // --- 1. TOGGLE LOGIC ---
    const toggleVnSprites = () => {
        if (vnCheckbox) {
            if (vnCheckbox.checked) {
                if(vnSpritesContainer) vnSpritesContainer.style.display = 'grid';
                if(vnGoalContainer) vnGoalContainer.style.display = 'block'; // [BRI UPDATE]
            } else {
                if(vnSpritesContainer) vnSpritesContainer.style.display = 'none';
                if(vnGoalContainer) vnGoalContainer.style.display = 'none'; // [BRI UPDATE]
            }
        }
    };
    if(vnCheckbox) {
        vnCheckbox.addEventListener('change', toggleVnSprites);
    }

    // Ambil ID dari URL
    const urlParams = new URLSearchParams(window.location.search);
    const charId = urlParams.get('id');

    if (!charId) {
        alert("ID Karakter tidak ditemukan!");
        window.location.href = 'index.html';
        return;
    }

    // Global variable untuk menyimpan state lama
    let currentData = {};

    // --- 2. LOAD DATA ---
    const loadCharacterData = async () => {
        try {
            formStatus.textContent = "Mengambil data...";
            const token = await getAuthTokenSafe();
            
            const res = await fetch(`/.netlify/functions/get-character?id=${charId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Gagal mengambil data karakter.");
            
            const data = await res.json();
            currentData = data; 

            // Cek Admin & VN Section
            const auth = firebase.auth();
            const user = auth.currentUser;
            const tokenResult = await user.getIdTokenResult();
            if (tokenResult.claims.admin) {
                const vnContainer = document.getElementById('vn-section-container');
                if(vnContainer) vnContainer.style.display = 'block';
            }

            // Populate Form
            maiIdInput.value = charId;
            nameInput.value = data.name || '';
            greetingInput.value = data.greeting || '';
            taglineInput.value = data.tagline || '';
            descInput.value = data.description || '';
            tagsInput.value = (data.tags || []).join(', ');
            
            if (data.image) avatarPreview.src = data.image;

            // Radio Button Visibility
            if (data.visibility === 'private') {
                document.querySelector('input[name="visibility"][value="private"]').checked = true;
            } else {
                document.querySelector('input[name="visibility"][value="public"]').checked = true;
            }

            // Populate VN Data
            if (data.isVnAvailable) {
                vnCheckbox.checked = true;
                // [BRI UPDATE: Isi Goal jika ada]
                if(gameGoalInput) gameGoalInput.value = data.gameGoal || '';
            } else {
                vnCheckbox.checked = false;
            }
            toggleVnSprites();

            // Preview Sprites Lama
            const emotions = ['happy', 'sad', 'angry', 'shy', 'surprised'];
            if (data.sprites) {
                emotions.forEach(emo => {
                    const preview = document.getElementById(`preview-${emo}`);
                    if (preview && data.sprites[emo]) {
                        preview.src = data.sprites[emo];
                    } else if (preview) {
                        preview.style.display = 'none';
                    }
                });
            }

            formStatus.textContent = "";

        } catch (error) {
            console.error(error);
            formStatus.textContent = "Error loading data.";
            formStatus.className = 'error';
        }
    };

    // --- 3. SUBMIT / UPDATE ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let token;
        try {
            token = await getAuthTokenSafe();
        } catch (error) {
            formStatus.textContent = 'Sesi habis. Login ulang.';
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Menyimpan...';
        formStatus.textContent = 'Mengupload perubahan...';
        formStatus.className = '';

        try {
            // A. Upload Gambar Utama Baru (Jika ada)
            let newMainImageUrl = currentData.image;
            if (mainImageInput.files[0]) {
                formStatus.textContent = 'Upload avatar baru...';
                newMainImageUrl = await uploadSingleImage(mainImageInput.files[0], token);
            }

            // B. Upload Sprites Baru (Jika ada & VN aktif)
            let updatedSprites = currentData.sprites || {};
            // Pastikan idle update jika main image ganti
            if (newMainImageUrl !== currentData.image) {
                updatedSprites['idle'] = newMainImageUrl;
            }

            if (vnCheckbox.checked) {
                const emotions = ['happy', 'sad', 'angry', 'shy', 'surprised'];
                for (const emo of emotions) {
                    const input = document.getElementById(`sprite-${emo}`);
                    if (input && input.files[0]) {
                        formStatus.textContent = `Upload sprite: ${emo}...`;
                        const url = await uploadSingleImage(input.files[0], token);
                        updatedSprites[emo] = url;
                    }
                }
            }

            // C. Siapkan Payload Update
            const updateData = {
                id: charId,
                name: nameInput.value,
                greeting: greetingInput.value,
                tagline: taglineInput.value,
                description: descInput.value,
                tags: tagsInput.value.split(',').map(t => t.trim()).filter(t => t),
                visibility: document.querySelector('input[name="visibility"]:checked').value,
                
                isVnAvailable: vnCheckbox.checked,
                
                // [BRI UPDATE: Kirim Goal yang diedit]
                gameGoal: gameGoalInput ? gameGoalInput.value : '',

                image: newMainImageUrl,
                sprites: updatedSprites
            };

            const saveRes = await fetch('/.netlify/functions/update-mai', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updateData)
            });

            if (!saveRes.ok) throw new Error("Gagal update database.");

            sessionStorage.removeItem('mai_chars_user'); // Clear cache
            formStatus.textContent = 'Update Berhasil!';
            formStatus.className = 'success';
            
            setTimeout(() => { window.location.href = 'index.html'; }, 1000);

        } catch (error) {
            console.error(error);
            formStatus.textContent = `Error: ${error.message}`;
            formStatus.className = 'error';
            submitButton.disabled = false;
            submitButton.textContent = 'Simpan Perubahan';
        }
    });

    // --- 4. DELETE ---
    deleteButton.addEventListener('click', async () => {
        if(!confirm("Yakin ingin menghapus karakter ini? Tindakan tidak bisa dibatalkan.")) return;

        try {
            const token = await getAuthTokenSafe();
            const res = await fetch('/.netlify/functions/delete-mai', {
                method: 'POST',
                headers: {
                     'Content-Type': 'application/json',
                     'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id: charId })
            });
            
            if(!res.ok) throw new Error("Gagal menghapus.");
            
            alert("Karakter dihapus.");
            window.location.href = 'index.html';

        } catch (e) {
            alert("Error: " + e.message);
        }
    });

    // Init Load
    const auth = firebase.auth();
    auth.onAuthStateChanged((user) => {
        if(user) loadCharacterData();
    });
});