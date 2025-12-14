// File: js/create-mai.js
// Versi: Multi-Upload + Admin Check + UI Toggle (Auto-Hide Sprites & Goal)

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
    const form = document.getElementById('create-mai-form');
    const mainImageInput = document.getElementById('mai-image');
    const avatarPreview = document.getElementById('avatar-preview');
    const submitButton = document.getElementById('submit-btn');
    const formStatus = document.getElementById('form-status');
    
    // Elemen VN
    const vnCheckbox = document.getElementById('mai-is-vn');
    const vnSpritesContainer = document.getElementById('vn-sprites-container');
    const vnGoalContainer = document.getElementById('vn-goal-container'); // [BRI UPDATE]

    // --- LOGIKA UI: TOGGLE SPRITES & GOAL ---
    const toggleVnSprites = () => {
        if (vnCheckbox) {
            if (vnCheckbox.checked) {
                // Munculkan Sprites & Goal
                if (vnSpritesContainer) vnSpritesContainer.style.display = 'grid';
                if (vnGoalContainer) vnGoalContainer.style.display = 'block'; // [BRI UPDATE]
            } else {
                // Sembunyikan Sprites & Goal
                if (vnSpritesContainer) vnSpritesContainer.style.display = 'none';
                if (vnGoalContainer) vnGoalContainer.style.display = 'none'; // [BRI UPDATE]
            }
        }
    };
    
    // Jalankan sekali saat loading agar sinkron
    if(vnCheckbox) {
        vnCheckbox.addEventListener('change', toggleVnSprites);
        toggleVnSprites(); 
    }

    // --- CEK STATUS LOGIN & ADMIN ---
    const auth = firebase.auth();
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            console.log('User tidak login, mengalihkan...');
            window.location.href = 'login.html';
        } else {
            try {
                const tokenResult = await user.getIdTokenResult();
                // Hanya tampilkan Container VN jika user adalah ADMIN
                if (tokenResult.claims.admin) {
                    const vnContainer = document.getElementById('vn-section-container');
                    if (vnContainer) vnContainer.style.display = 'block';
                }
            } catch (e) {
                console.error("Gagal cek claim admin:", e);
            }
        }
    });

    // --- Preview Gambar Utama ---
    mainImageInput.addEventListener('change', () => {
        const file = mainImageInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => { avatarPreview.src = e.target.result; }
            reader.readAsDataURL(file);
        }
    });

    // --- LOGIKA SUBMIT ---
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

        submitButton.disabled = true;
        submitButton.textContent = 'Memproses...';
        formStatus.textContent = 'Mulai meng-upload...';
        formStatus.className = '';

        try {
            // 1. Upload Avatar Utama
            const mainFile = mainImageInput.files[0];
            if (!mainFile) throw new Error("Avatar utama wajib diisi!");
            
            formStatus.textContent = 'Meng-upload avatar utama...';
            const mainImageUrl = await uploadSingleImage(mainFile, token);

            // 2. Upload Sprite Ekspresi (Hanya jika VN dicentang)
            const sprites = {};
            const emotions = ['happy', 'sad', 'angry', 'shy', 'surprised'];
            
            sprites['idle'] = mainImageUrl; 

            if (vnCheckbox.checked) {
                for (const emo of emotions) {
                    const input = document.getElementById(`sprite-${emo}`);
                    if (input && input.files[0]) {
                        formStatus.textContent = `Meng-upload ekspresi: ${emo}...`;
                        const url = await uploadSingleImage(input.files[0], token);
                        sprites[emo] = url;
                    }
                }
            }

            // 3. Simpan Data
            formStatus.textContent = 'Menyimpan data karakter...';
            const maiData = {
                name: document.getElementById('mai-name').value,
                greeting: document.getElementById('mai-greeting').value,
                tagline: document.getElementById('mai-tagline').value,
                description: document.getElementById('mai-description').value,
                tags: document.getElementById('mai-tags').value.split(',').map(t => t.trim()).filter(t => t),
                visibility: document.querySelector('input[name="visibility"]:checked').value,
                isVnAvailable: vnCheckbox.checked,
                
                // [BRI UPDATE: Kirim Goal ke Backend]
                gameGoal: document.getElementById('mai-game-goal') ? document.getElementById('mai-game-goal').value : '',

                image: mainImageUrl,
                sprites: sprites 
            };

            const saveRes = await fetch('/.netlify/functions/save-mai', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(maiData)
            });

            if (!saveRes.ok) throw new Error("Gagal menyimpan ke database.");

            sessionStorage.removeItem('mai_chars_user');
            formStatus.textContent = 'Berhasil! Mengalihkan...';
            formStatus.className = 'success';
            
            setTimeout(() => { window.location.href = 'index.html'; }, 1500);

        } catch (error) {
            console.error(error);
            formStatus.textContent = `Error: ${error.message}`;
            formStatus.className = 'error';
            submitButton.disabled = false;
            submitButton.textContent = 'Buat MAI';
        }
    });
});