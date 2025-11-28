// File: js/edit-mai.js

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

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const charId = params.get('id');

    if (!charId) {
        alert("ID Karakter tidak ditemukan.");
        window.location.href = 'index.html';
        return;
    }

    // --- Load Data Lama ---
    try {
        const response = await fetch(`/.netlify/functions/get-character?id=${charId}`);
        if (!response.ok) throw new Error("Gagal mengambil data.");
        
        const data = await response.json();

        // Isi form dengan data lama
        document.getElementById('mai-id').value = charId;
        document.getElementById('mai-name').value = data.name;
        document.getElementById('mai-greeting').value = data.greeting;
        document.getElementById('mai-tagline').value = data.tagline || '';
        document.getElementById('mai-description').value = data.description;
        document.getElementById('mai-tags').value = (data.tags || []).join(', ');
        document.getElementById('avatar-preview').src = data.image;
        document.getElementById('current-image-url').value = data.image;

        if (data.visibility === 'private') {
            document.getElementById('vis-private').checked = true;
        } else {
            document.getElementById('vis-public').checked = true;
        }

    } catch (error) {
        console.error(error);
        alert("Gagal memuat data karakter.");
    }

    // --- Handle Image Preview ---
    const imageInput = document.getElementById('mai-image');
    const avatarPreview = document.getElementById('avatar-preview');
    
    avatarPreview.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', () => {
        const file = imageInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => { avatarPreview.src = e.target.result; }
            reader.readAsDataURL(file);
        }
    });

    // --- Handle Cancel ---
    document.getElementById('cancel-btn').addEventListener('click', () => {
        window.location.href = `chat.html?id=${charId}`;
    });

    // --- Handle Submit ---
    document.getElementById('edit-mai-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('submit-btn');
        const statusMsg = document.getElementById('form-status');
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Menyimpan...';
        statusMsg.textContent = '';

        try {
            const token = await getAuthTokenSafe();
            let imageUrl = document.getElementById('current-image-url').value;

            // 1. Jika ada gambar baru, upload dulu
            const file = imageInput.files[0];
            if (file) {
                statusMsg.textContent = 'Meng-upload gambar baru...';
                const fileBase64 = await readFileAsBase64(file);
                const uploadRes = await fetch('/.netlify/functions/upload-image', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({ file: fileBase64 })
                });
                if (!uploadRes.ok) throw new Error("Gagal upload gambar.");
                const uploadData = await uploadRes.json();
                imageUrl = uploadData.secure_url;
            }

            // 2. Kirim Update Data
            statusMsg.textContent = 'Mengupdate data...';
            const payload = {
                id: charId,
                name: document.getElementById('mai-name').value,
                greeting: document.getElementById('mai-greeting').value,
                tagline: document.getElementById('mai-tagline').value,
                description: document.getElementById('mai-description').value,
                tags: document.getElementById('mai-tags').value.split(',').map(t => t.trim()).filter(t => t),
                visibility: document.querySelector('input[name="visibility"]:checked').value,
                image: imageUrl
            };

            const updateRes = await fetch('/.netlify/functions/update-mai', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(payload)
            });

            if (!updateRes.ok) {
                const err = await updateRes.json();
                throw new Error(err.error || "Gagal update.");
            }

            statusMsg.textContent = "Berhasil diupdate! Kembali ke chat...";
            statusMsg.className = "success";
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
});