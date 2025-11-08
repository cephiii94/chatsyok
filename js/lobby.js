// File: js/lobby.js (DIMODIFIKASI)

/**
 * Mengambil data karakter dan membangun kartu di halaman.
 */
async function loadCharacters() {
  const grid = document.getElementById('character-grid');
  if (!grid) return; // Hentikan jika grid tidak ditemukan

  // BARU: Dapatkan status login
  // Kita akan menunggu event 'authReady' dari auth-guard.js
  if (!authInitializationDone) {
      console.log("Lobby: Menunggu authReady...");
      await new Promise(resolve => document.addEventListener('authReady', resolve, { once: true }));
      console.log("Lobby: authReady diterima.");
  }
    
  const user = window.currentUser; // Ambil dari flag global yang di-set oleh auth-guard
  const isGuest = !user;
  console.log("Lobby: Status user: ", isGuest ? "Tamu" : "Login");

  // BARU: Tentukan URL berdasarkan status login
  const fetchUrl = isGuest 
      ? '/.netlify/functions/get-all-characters?guest=true' 
      : '/.netlify/functions/get-all-characters';

  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error("Gagal mengambil data karakter dari server.");
    }
    
    const characters = await response.json();

    // 1. Kosongkan skeleton loader
    grid.innerHTML = ''; 

    if (characters.length === 0) {
        if (isGuest) {
             grid.innerHTML = '<p style="color: var(--text-secondary);">Tidak ada MAI default ditemukan. Silakan login untuk melihat lebih banyak.</p>';
        } else {
             grid.innerHTML = '<p style="color: var(--text-secondary);">Belum ada MAI publik. Jadilah yang pertama membuatnya!</p>';
        }
        return;
    }

    // 2. Loop data dari Firestore dan buat kartu baru
    characters.forEach(char => {
      // (Logika rendering kartu tidak berubah)
      const card = document.createElement('div');
      card.className = 'character-card';
      card.dataset.charId = char.id; 

      const img = document.createElement('img');
      img.src = char.image; 
      img.alt = char.name;  

      const infoDiv = document.createElement('div');
      infoDiv.className = 'character-card-info';

      const h3 = document.createElement('h3');
      h3.textContent = char.name; 

      const p = document.createElement('p');
      p.textContent = char.tagline || char.description; 
      
      infoDiv.appendChild(h3);
      infoDiv.appendChild(p);
      card.appendChild(img);
      card.appendChild(infoDiv);

      // (PENTING) Modifikasi event listener
      card.addEventListener('click', () => {
        if (isGuest) {
            // Jika tamu, jangan biarkan chat, minta login
            alert('Silakan login untuk memulai obrolan.');
            window.location.href = 'login.html';
        } else {
            // Jika login, arahkan ke chat
            window.location.href = `chat.html?id=${char.id}`;
        }
      });

      // Tambahkan kartu baru ke grid
      grid.appendChild(card);
    });

  } catch (error) {
    console.error(error);
    // Tampilkan pesan error jika gagal
    grid.innerHTML = '<p style="color: red;">Gagal memuat karakter. Coba muat ulang halaman.</p>';
  }
}


/**
 * Logika untuk navigasi mobile (Hamburger Menu)
 * (Kode ini tidak berubah)
 */
function setupMobileNav() {
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
}

// --- Titik Masuk Aplikasi ---
document.addEventListener('DOMContentLoaded', () => {
  // Jalankan kedua fungsi saat halaman dimuat
  setupMobileNav();
  loadCharacters(); // loadCharacters sekarang akan menunggu auth siap
});