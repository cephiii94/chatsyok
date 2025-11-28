// File: js/lobby.js (UPDATE LENGKAP DENGAN MODAL PROFIL)

// Variabel global untuk menyimpan data karakter sementara
let selectedCharacterId = null;

/**
 * Mengambil data karakter dan membangun kartu di halaman.
 */
async function loadCharacters() {
  const grid = document.getElementById('character-grid');
  if (!grid) return; 

  // Menunggu auth siap
  if (!authInitializationDone) {
      console.log("Lobby: Menunggu authReady...");
      await new Promise(resolve => document.addEventListener('authReady', resolve, { once: true }));
  }
    
  const user = window.currentUser; 
  const isGuest = !user;
  console.log("Lobby: Status user: ", isGuest ? "Tamu" : "Login");

  // Tentukan URL API
  const fetchUrl = isGuest 
      ? '/.netlify/functions/get-all-characters?guest=true' 
      : '/.netlify/functions/get-all-characters';

  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error("Gagal mengambil data karakter.");
    
    const characters = await response.json();

    // Kosongkan grid (hapus skeleton loader)
    grid.innerHTML = ''; 

    if (characters.length === 0) {
        grid.innerHTML = isGuest 
            ? '<p style="color: var(--text-secondary);">Tidak ada MAI default ditemukan.</p>' 
            : '<p style="color: var(--text-secondary);">Belum ada MAI publik.</p>';
        return;
    }

    // Loop dan buat kartu
    characters.forEach(char => {
      const card = document.createElement('div');
      card.className = 'character-card';
      // Simpan seluruh data char di dataset elemen agar mudah diambil nanti (opsional, tapi kita pakai passing object langsung)
      
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

      // ▼▼▼ MODIFIKASI: Klik kartu membuka MODAL PROFIL, bukan langsung chat ▼▼▼
      card.addEventListener('click', () => {
          openProfileModal(char, isGuest);
      });
      // ▲▲▲

      grid.appendChild(card);
    });

  } catch (error) {
    console.error(error);
    grid.innerHTML = '<p style="color: red;">Gagal memuat karakter.</p>';
  }
}

/**
 * Fungsi BARU: Membuka Modal Profil MAI
 * @param {Object} char - Data karakter (nama, img, desc, tags, id)
 * @param {Boolean} isGuest - Status login user
 */
function openProfileModal(char, isGuest) {
    const modal = document.getElementById('character-profile-modal');
    const imgEl = document.getElementById('modal-char-img');
    const nameEl = document.getElementById('modal-char-name');
    const descEl = document.getElementById('modal-char-desc');
    const tagsContainer = document.getElementById('modal-char-tags');
    const startBtn = document.getElementById('btn-start-chat');

    // 1. Isi Data ke dalam Modal
    imgEl.src = char.image;
    nameEl.textContent = char.name;
    descEl.textContent = char.tagline || char.description; // Prioritaskan tagline jika ada
    
    // Simpan ID karakter yang sedang dilihat ke variabel global
    selectedCharacterId = char.id;

    // Render Tags (chip)
    tagsContainer.innerHTML = ''; // Bersihkan tag lama
    if (char.tags && Array.isArray(char.tags)) {
        char.tags.forEach(tag => {
            const span = document.createElement('span');
            span.textContent = tag;
            tagsContainer.appendChild(span);
        });
    }

    // 2. Tampilkan Modal
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('visible'), 10); // Delay dikit biar animasi CSS jalan

    // 3. Atur Logika Tombol "Mulai Chat"
    // Kita hapus listener lama (kloning elemen) agar tidak menumpuk event click berkali-kali
    const newStartBtn = startBtn.cloneNode(true);
    startBtn.parentNode.replaceChild(newStartBtn, startBtn);

    newStartBtn.addEventListener('click', () => {
        if (isGuest) {
            // Logika Tamu: Tampilkan alert atau arahkan login
            // (Atau bisa trigger modal guest yang sudah ada)
            alert('Fitur Chat hanya untuk pengguna terdaftar. Silakan login.');
            window.location.href = 'login.html';
        } else {
            // Logika User: Pergi ke halaman chat
            window.location.href = `chat.html?id=${selectedCharacterId}`;
        }
    });
}

/**
 * Menyiapkan Event Listener untuk menutup Modal Profil
 */
function setupModalEvents() {
    const modal = document.getElementById('character-profile-modal');
    const closeBtn = document.getElementById('close-profile-modal');

    // Fungsi tutup modal
    const closeModal = () => {
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300); // Sesuaikan dengan durasi transition CSS
    };

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    // Tutup jika klik di area gelap (overlay)
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
}

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
  setupMobileNav();
  setupModalEvents(); // Inisialisasi event modal (tutup/overlay)
  loadCharacters(); 
});