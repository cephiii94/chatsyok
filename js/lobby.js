// File: js/lobby.js (Lengkap dan Diperbarui)

/**
 * Fungsi baru untuk mengambil data semua karakter dari server
 * dan membangun kartu-kartu di halaman.
 */
async function loadCharacters() {
  const grid = document.getElementById('character-grid');
  if (!grid) return; // Hentikan jika grid tidak ditemukan

  try {
    const response = await fetch('/.netlify/functions/get-all-characters');
    if (!response.ok) {
      throw new Error("Gagal mengambil data karakter dari server.");
    }
    
    const characters = await response.json();

    // 1. Kosongkan skeleton loader
    grid.innerHTML = ''; 

    // 2. Loop data dari Firestore dan buat kartu baru
    characters.forEach(char => {
      // (Opsional) Hanya tampilkan MAI yang 'public'
      if (char.visibility === 'private') {
        return; // Lewati bot privat
      }

      // Buat elemen kartu
      const card = document.createElement('div');
      card.className = 'character-card';
      // (PENTING) Set ID karakter untuk link
      card.dataset.charId = char.id; 

      // Buat elemen gambar
      const img = document.createElement('img');
      img.src = char.image; // Data dari Firestore
      img.alt = char.name;  // Data dari Firestore

      // Buat elemen info
      const infoDiv = document.createElement('div');
      infoDiv.className = 'character-card-info';

      const h3 = document.createElement('h3');
      h3.textContent = char.name; // Data dari Firestore

      // ▼▼▼ MODIFIKASI DI SINI ▼▼▼
      // Gunakan 'tagline' (deskripsi singkat) untuk kartu.
      // Jika 'tagline' tidak ada, gunakan 'description' sebagai cadangan.
      const p = document.createElement('p');
      p.textContent = char.tagline || char.description; 
      // ▼▼▼ AKHIR MODIFIKASI ▼▼▼

      // Susun elemen-elemen
      infoDiv.appendChild(h3);
      infoDiv.appendChild(p);
      card.appendChild(img);
      card.appendChild(infoDiv);

      // (PENTING) Tambahkan event listener ke kartu yang baru dibuat
      card.addEventListener('click', () => {
        window.location.href = `chat.html?id=${char.id}`;
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
  loadCharacters();
});