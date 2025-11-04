document.addEventListener('DOMContentLoaded', () => {

    // --- Navigasi Mobile ---
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

    // --- Navigasi Halaman ---
    const characterCards = document.querySelectorAll('.character-card');

    characterCards.forEach(card => {
        card.addEventListener('click', () => {
            // Nanti kita bisa kirim data karakter, untuk sekarang kita pindah halaman saja
            // const charId = card.dataset.charId;
            // window.location.href = `chat.html?id=${charId}`;
            
            // Untuk sekarang, langsung pindah ke chat.html
            window.location.href = 'chat.html';
        });
    });

});
