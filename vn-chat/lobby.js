// vn-chat/lobby.js (Versi Dinamis Firebase)

document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('character-grid');
    
    // Tampilkan loading sementara
    grid.innerHTML = '<p style="color: white;">Memuat karakter VN...</p>';

    try {
        // 1. Panggil fungsi backend dengan mode=vn
        const response = await fetch('/.netlify/functions/get-all-characters?mode=vn');
        
        if (!response.ok) throw new Error("Gagal mengambil data");
        
        const characters = await response.json();
        
        // Bersihkan loading
        grid.innerHTML = '';

        if (characters.length === 0) {
            grid.innerHTML = '<p style="color: white;">Belum ada karakter untuk Visual Novel.</p>';
            return;
        }

        // 2. Render Kartu Karakter
        characters.forEach((char, index) => {
            const card = document.createElement('div');
            // Cek apakah ada properti locked (opsional, bisa diambil dari firebase juga nanti)
            const isLocked = char.locked === true; 
            
            card.className = `char-card ${isLocked ? 'locked' : ''}`;
            card.style.animationDelay = `${index * 0.1}s`;

            if (!isLocked) {
                card.addEventListener('click', () => {
                    // Arahkan ke chat VN dengan ID karakter
                    window.location.href = `chat.html?id=${char.id}`;
                });
            }

            // Gunakan gambar dari Cloudinary/Firebase, atau placeholder jika kosong
            const charImage = char.image || "https://placehold.co/400x600/1a1a2e/FFF?text=No+Image";
            const statusLabel = isLocked ? 'LOCKED' : 'READY';
            const statusColor = isLocked ? '#7f8c8d' : '#4cd137';

            card.innerHTML = `
                <div class="char-image-wrapper">
                    <img src="${charImage}" alt="${char.name}" class="char-image">
                    <div class="status-badge" style="background: ${statusColor}">${statusLabel}</div>
                </div>
                <div class="char-info">
                    <h2 class="char-name">${char.name}</h2>
                    <p class="char-desc">${char.tagline || char.description}</p>
                </div>
            `;

            grid.appendChild(card);
        });

    } catch (error) {
        console.error(error);
        grid.innerHTML = '<p style="color: #ff6b6b;">Terjadi kesalahan saat memuat karakter.</p>';
    }
});