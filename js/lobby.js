// File: js/lobby.js (FINAL FULL VERSION)

let selectedCharacterId = null;

// Helper: Konfirmasi Cantik
function showCustomConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const msgEl = document.getElementById('confirm-msg');
        const yesBtn = document.getElementById('btn-confirm-yes');
        const cancelBtn = document.getElementById('btn-confirm-cancel');

        if (!modal) {
            resolve(confirm(message)); 
            return;
        }

        titleEl.textContent = title;
        msgEl.textContent = message;
        
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('visible'), 10);

        const close = (result) => {
            modal.classList.remove('visible');
            setTimeout(() => modal.style.display = 'none', 300);
            yesBtn.onclick = null;
            cancelBtn.onclick = null;
            resolve(result);
        };

        yesBtn.onclick = () => close(true);
        cancelBtn.onclick = () => close(false);
    });
}

// Helper: Optimasi Gambar
function optimizeCloudinaryUrl(url, width = 300) {
    if (!url || !url.includes('cloudinary.com')) return url;
    return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width},c_fill/`);
}

async function loadCharacters() {
  const grid = document.getElementById('character-grid');
  if (!grid) return; 

  if (!authInitializationDone) {
      await new Promise(resolve => document.addEventListener('authReady', resolve, { once: true }));
  }
    
  const user = window.currentUser; 
  const isGuest = !user;
  const storageKey = isGuest ? 'mai_chars_guest' : 'mai_chars_user';

  const cachedData = sessionStorage.getItem(storageKey);
  
  if (cachedData) {
      console.log("🚀 Lobby: Cache Hit");
      const characters = JSON.parse(cachedData);
      renderCharacterGrid(characters, isGuest);
      fetchAndSaveCharacters(isGuest, storageKey, false); 
  } else {
      console.log("🐢 Lobby: Cache Miss, Fetching...");
      await fetchAndSaveCharacters(isGuest, storageKey, true);
  }
}

async function fetchAndSaveCharacters(isGuest, storageKey, forceRender) {
    const fetchUrl = isGuest 
        ? '/.netlify/functions/get-all-characters?guest=true' 
        : '/.netlify/functions/get-all-characters';

    try {
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error("Gagal fetch data");
        
        const characters = await response.json();
        sessionStorage.setItem(storageKey, JSON.stringify(characters));

        if (forceRender) {
            renderCharacterGrid(characters, isGuest);
        }
    } catch (error) {
        console.error("Gagal update data:", error);
        if (forceRender) {
            document.getElementById('character-grid').innerHTML = '<p style="color:red; text-align:center;">Gagal memuat karakter.</p>';
        }
    }
}

function renderCharacterGrid(characters, isGuest) {
    const grid = document.getElementById('character-grid');
    grid.innerHTML = ''; 

    if (characters.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px;">
            ${isGuest ? 'Tidak ada MAI default.' : 'Belum ada MAI publik. Yuk buat satu!'}
        </div>`;
        return;
    }

    characters.forEach(char => {
        const card = document.createElement('div');
        card.className = 'character-card';
        
        const optimizedImage = optimizeCloudinaryUrl(char.image, 300);

        const img = document.createElement('img');
        img.src = optimizedImage; 
        img.alt = char.name;
        img.loading = "lazy";

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

        card.addEventListener('click', () => {
            openProfileModal(char, isGuest);
        });

        grid.appendChild(card);
    });
}

async function openProfileModal(char, isGuest) {
    const modal = document.getElementById('character-profile-modal');
    const imgEl = document.getElementById('modal-char-img');
    const nameEl = document.getElementById('modal-char-name');
    const descEl = document.getElementById('modal-char-desc');
    const tagsContainer = document.getElementById('modal-char-tags');
    const startBtn = document.getElementById('btn-start-chat');
    const adminActionsDiv = document.getElementById('modal-admin-actions');

    imgEl.src = optimizeCloudinaryUrl(char.image, 500); 
    nameEl.textContent = char.name;
    descEl.textContent = char.tagline || char.description; 
    selectedCharacterId = char.id;

    tagsContainer.innerHTML = '';
    if (char.tags && Array.isArray(char.tags)) {
        char.tags.forEach(tag => {
            const span = document.createElement('span');
            span.textContent = tag;
            tagsContainer.appendChild(span);
        });
    }

    if (adminActionsDiv) adminActionsDiv.innerHTML = '';

    // --- TOMBOL ADMIN/CREATOR ---
    if (!isGuest && window.currentUser) {
        try {
            const tokenResult = await window.currentUser.getIdTokenResult();
            const isAdmin = tokenResult.claims.admin === true;
            const isCreator = char.creatorId === window.currentUser.uid;

            if (isCreator || isAdmin) {
                const editBtn = document.createElement('button');
                editBtn.textContent = '✏️ Edit';
                editBtn.className = 'btn-secondary';
                Object.assign(editBtn.style, {
                    flex: '1', padding: '10px', border: '1px solid #ccc', 
                    borderRadius: '8px', cursor: 'pointer', backgroundColor: '#fff'
                });
                editBtn.onclick = () => window.location.href = `edit-mai.html?id=${char.id}`;

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '🗑️ Hapus';
                Object.assign(deleteBtn.style, {
                    flex: '1', padding: '10px', border: 'none', 
                    borderRadius: '8px', cursor: 'pointer', 
                    backgroundColor: '#ffebee', color: '#c62828', fontWeight: '600'
                });
                
                deleteBtn.onclick = async () => {
                    const isConfirmed = await showCustomConfirm(
                        "Hapus Karakter?", 
                        `Yakin ingin menghapus "${char.name}" secara permanen? Tindakan ini tidak bisa dibatalkan.`
                    );
                    
                    if (!isConfirmed) return;
                    
                    deleteBtn.textContent = '⏳...';
                    deleteBtn.disabled = true;

                    try {
                        const token = await window.currentUser.getIdToken(true);
                        const res = await fetch(`/.netlify/functions/delete-mai?id=${char.id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });

                        if (res.ok) {
                            sessionStorage.removeItem('mai_chars_user'); 
                            sessionStorage.removeItem('mai_chars_guest');
                            window.location.reload();
                        } else {
                            const err = await res.json();
                            throw new Error(err.error);
                        }
                    } catch (e) {
                        alert("Gagal hapus: " + e.message);
                        deleteBtn.textContent = '🗑️ Hapus';
                        deleteBtn.disabled = false;
                    }
                };

                if (adminActionsDiv) {
                    adminActionsDiv.appendChild(editBtn);
                    adminActionsDiv.appendChild(deleteBtn);
                }
            }
        } catch (e) { console.log("Gagal cek akses admin:", e); }
    }

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('visible'), 10);

    const newStartBtn = startBtn.cloneNode(true);
    startBtn.parentNode.replaceChild(newStartBtn, startBtn);

    newStartBtn.addEventListener('click', () => {
        if (isGuest) {
            const guestModal = document.getElementById('guest-login-modal');
            modal.classList.remove('visible');
            setTimeout(() => modal.style.display = 'none', 300);
            if(guestModal) {
                guestModal.style.display = 'flex';
                setTimeout(() => guestModal.classList.add('visible'), 10);
            }
        } else {
            window.location.href = `chat.html?id=${selectedCharacterId}`;
        }
    });
}

function setupModalEvents() {
    const modal = document.getElementById('character-profile-modal');
    const closeBtn = document.getElementById('close-profile-modal');

    const closeModal = () => {
        modal.classList.remove('visible');
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
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

document.addEventListener('DOMContentLoaded', () => {
  setupMobileNav();
  setupModalEvents();
  loadCharacters(); 
});