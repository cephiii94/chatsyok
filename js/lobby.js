document.addEventListener('DOMContentLoaded', () => {

    // --- Navigasi Mobile (Tidak berubah) ---
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const lobbySidebar = document.getElementById('lobby-sidebar');
    const menuOverlay = document.getElementById('menu-overlay');

    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', () => {
            lobbySidebar.classList.add('sidebar-visible');
            menuOverlay.classList.add('overlay-visible');
        });
    }

    if (menuOverlay) {
        menuOverlay.addEventListener('click', () => {
            lobbySidebar.classList.remove('sidebar-visible');
            menuOverlay.classList.remove('overlay-visible');
        });
    }

    // --- Navigasi Halaman (INI YANG DIPERBARUI) ---
    const characterCards = document.querySelectorAll('.character-card');

    characterCards.forEach(card => {
        card.addEventListener('click', () => {
            // 1. Ambil ID karakter dari atribut 'data-char-id' di HTML
            const charId = card.dataset.charId;
            
            // 2. Arahkan ke halaman chat DENGAN menyertakan ID sebagai query parameter
            window.location.href = `chat.html?id=${charId}`;
        });
    });

});