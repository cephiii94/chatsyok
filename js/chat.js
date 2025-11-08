// File: js/chat.js (DIMODIFIKASI BESAR)

// === 1. GLOBAL VARIABLES ===
let currentChatbotProfile = "";
let currentCharacterName = "";
let currentCharacterGreeting = "";
let currentCharacterId = "1"; 
let currentUser = null; // BARU: Untuk menyimpan data user
let currentAuthToken = null; // BARU: Untuk menyimpan token

// --- Variabel untuk Elemen DOM ---
let chatTranscript;
let chatInput;
let sendButton;
let uploadButton;
let fileInput;
let backButton;


// === 2. FUNGSI BARU UNTUK OTENTIKASI ===

/**
 * Mengambil Firebase Auth Token yang valid.
 * Akan me-refresh jika perlu.
 */
async function getAuthToken() {
    if (!currentUser) {
        console.error("getAuthToken: Dipanggil saat user null.");
        alert("Sesi Anda tidak valid. Mengalihkan ke login.");
        window.location.href = 'login.html';
        throw new Error("User tidak login.");
    }
    try {
        // 'true' memaksa refresh token jika sudah kedaluwarsa
        currentAuthToken = await currentUser.getIdToken(true); 
        return currentAuthToken;
    } catch (error) {
        console.error("Gagal mendapatkan auth token:", error);
        alert("Sesi Anda berakhir. Harap login kembali.");
        window.location.href = 'login.html';
        throw error; // Lempar error untuk menghentikan proses selanjutnya
    }
}


// === 3. FUNGSI UTAMA (DIMODIFIKASI) ===

/**
 * Memuat profil karakter dari server Netlify.
 * (Fungsi ini tidak perlu token, karena profil MAI bersifat publik)
 */
async function loadCharacterProfile(characterId) {
  console.log(`Mencoba memuat karakter ID: ${characterId} dari server...`);
  const functionUrl = `/.netlify/functions/get-character?id=${characterId}`;
  const leftPanel = document.querySelector('.chat-left-panel');
  try {
    const response = await fetch(functionUrl);
    if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
    
    const character = await response.json();
    console.log("Data karakter diterima:", character);

    currentChatbotProfile = character.description; 
    currentCharacterName = character.name; 
    currentCharacterGreeting = character.greeting;
    
    // Memuat data ke Panel Kiri
    const profileImg = document.querySelector('.chat-left-panel .profile-img');
    const profileName = document.querySelector('.chat-left-panel h4');
    const profileDesc = document.querySelector('.chat-left-panel p');
    const tagsContainer = document.querySelector('.chat-left-panel .tags');

    if (profileImg) profileImg.src = character.image;
    if (profileName) profileName.textContent = character.name;
    if (profileDesc) profileDesc.textContent = character.tagline || character.description;
    
    if (tagsContainer) {
      tagsContainer.innerHTML = '';
      if (character.tags && Array.isArray(character.tags)) {
        character.tags.forEach(tagText => {
          const tagElement = document.createElement('span');
          tagElement.textContent = tagText;
          tagsContainer.appendChild(tagElement);
        });
      }
    }
    leftPanel.classList.remove('is-loading');
  } catch (error) {
    console.error("Error mengambil data karakter:", error);
    const profileName = document.querySelector('.chat-left-panel h4');
    if (profileName) profileName.textContent = "Gagal memuat";
    leftPanel.classList.remove('is-loading');
  }
}

/**
 * Memuat riwayat obrolan dari server Netlify.
 * (Sekarang aman dan privat per user)
 */
async function loadChatHistory(characterId) {
  console.log(`Memuat riwayat obrolan untuk ID: ${characterId}`);
  try {
    // MODIFIKASI: Dapatkan token dulu
    const token = await getAuthToken();
    
    const response = await fetch(`/.netlify/functions/get-history?id=${characterId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // BARU: Kirim token
        }
    });

    if (!response.ok) {
        if (response.status === 401) throw new Error("Otentikasi gagal.");
        throw new Error("Gagal mengambil riwayat.");
    }
    
    const history = await response.json();

    const initialBotMessage = document.querySelector('.chat-bubble.bot');
    if (history.length > 0 && initialBotMessage) {
      chatTranscript.innerHTML = ''; // Kosongkan transkrip jika ada riwayat
    }

    history.forEach(message => {
      addMessageToTranscript(message.text, message.sender);
    });

    if (history.length === 0 && initialBotMessage) {
      initialBotMessage.textContent = currentCharacterGreeting || `Halo! Saya ${currentCharacterName || "Bot"}. Ada yang bisa saya bantu?`;
    }

  } catch (error) {
    console.error("Error memuat riwayat:", error);
  }
}

/**
 * Menyimpan satu pesan ke database.
 * (Sekarang aman dan privat per user)
 */
async function saveMessage(sender, text) {
  try {
    // MODIFIKASI: Dapatkan token (gunakan yang sudah ada jika masih baru)
    const token = currentAuthToken || await getAuthToken();

    const response = await fetch('/.netlify/functions/save-message', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // BARU: Kirim token
        },
        body: JSON.stringify({
            characterId: currentCharacterId,
            sender: sender,
            text: text
        })
    });

    if (!response.ok) {
        throw new Error("Gagal menyimpan pesan ke server.");
    }

  } catch (error) {
     console.error("Gagal menyimpan pesan ke DB:", error);
  }
}

/**
 * Menangani pengiriman pesan TEKS.
 * (Sekarang aman)
 */
async function handleSendMessage() {
  const messageText = chatInput.value.trim();
  
  if (messageText === '' || !currentChatbotProfile || !currentCharacterName || chatInput.disabled) return; 

  addMessageToTranscript(messageText, 'user');
  await saveMessage('user', messageText); // Tunggu simpan selesai
  
  chatInput.value = ''; 
  setChatInputDisabled(true); 
  const typingBubble = addMessageToTranscript("...", 'bot', 'typing');

  try {
    // MODIFIKASI: Dapatkan token
    const token = await getAuthToken();

    const response = await fetch('/.netlify/functions/get-chat-response', {
      method: 'POST',
      headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // BARU: Kirim token
      },
      body: JSON.stringify({
        userMessage: messageText,
        characterProfile: currentChatbotProfile, 
        characterName: currentCharacterName
      })
    });
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Gagal mendapat balasan dari server");
    }
    
    const data = await response.json();
    typingBubble.textContent = data.reply; 
    typingBubble.classList.remove('typing');
    
    await saveMessage('bot', data.reply); // Tunggu simpan balasan bot

  } catch (error) {
    console.error("Error saat mengirim chat:", error);
    typingBubble.textContent = `Maaf, terjadi error: ${error.message}`;
    typingBubble.classList.remove('typing');
  } finally {
    setChatInputDisabled(false); 
    if (chatInput) chatInput.focus();
  }
}

/**
 * Menangani pengiriman GAMBAR.
 * (Sekarang aman)
 */
async function handleFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const uploadBubble = addMessageToTranscript("Meng-upload gambar...", 'user', 'uploading');
  setChatInputDisabled(true);

  try {
    const fileBase64 = await readFileAsBase64(file);
    
    // MODIFIKASI: Dapatkan token
    const token = await getAuthToken();

    const response = await fetch('/.netlify/functions/upload-image', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // BARU: Kirim token
      },
      body: JSON.stringify({ file: fileBase64 })
    });

    if (!response.ok) throw new Error("Gagal meng-upload file ke server.");

    const data = await response.json();
    const secureUrl = data.secure_url;

    chatTranscript.removeChild(uploadBubble);
    addMessageWithImage(secureUrl, 'user');
    
    await saveMessage('user', secureUrl); // Simpan URL gambar
    
    // Respons bot (sementara)
    const typingBubble = addMessageToTranscript("...", 'bot', 'typing');
    typingBubble.textContent = "Wah, gambar yang bagus!";
    typingBubble.classList.remove('typing');
    await saveMessage('bot', typingBubble.textContent); 
    
  } catch (error) {
    console.error("Error saat upload gambar:", error);
    uploadBubble.textContent = "Gagal meng-upload gambar.";
    uploadBubble.classList.remove('uploading');
  } finally {
    setChatInputDisabled(false);
    event.target.value = null; // Reset input file
  }
}


// === 4. FUNGSI PEMBANTU (Tidak Berubah) ===

function setChatInputDisabled(disabled) {
  if (chatInput) chatInput.disabled = disabled;
  if (sendButton) sendButton.disabled = disabled;
  if (uploadButton) uploadButton.disabled = disabled;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

function addMessageWithImage(imageUrl, sender) {
  // (Sama seperti sebelumnya)
  const bubble = document.createElement('div');
  bubble.classList.add('chat-bubble', sender, 'image-bubble');
  const img = document.createElement('img');
  img.src = imageUrl;
  img.alt = "Gambar yang di-upload";
  bubble.appendChild(img);
  chatTranscript.appendChild(bubble);
  chatTranscript.scrollTop = chatTranscript.scrollHeight;
  return bubble;
}

function addMessageToTranscript(text, sender, extraClass = null) {
  // (Sama seperti sebelumnya)
  if (text.startsWith('https://res.cloudinary.com')) {
    return addMessageWithImage(text, sender);
  }
  const bubble = document.createElement('div');
  bubble.classList.add('chat-bubble', sender);
  if (extraClass) bubble.classList.add(extraClass);
  bubble.textContent = text; 
  chatTranscript.appendChild(bubble);
  chatTranscript.scrollTop = chatTranscript.scrollHeight;
  return bubble; 
}


// === 5. TITIK MASUK APLIKASI ===
document.addEventListener('DOMContentLoaded', async () => {
  
  // --- A. Mengisi variabel elemen DOM ---
  chatTranscript = document.getElementById('chat-transcript');
  chatInput = document.getElementById('chat-input');
  sendButton = document.getElementById('send-button');
  backButton = document.getElementById('back-btn');
  uploadButton = document.getElementById('upload-btn');
  fileInput = document.getElementById('file-input');

  // --- B. Logika Startup ---
  
  // BARU: Cek Auth dulu
  // Kita tunggu auth-guard.js selesai
  if (!authInitializationDone) {
      console.log("Chat: Menunggu authReady...");
      await new Promise(resolve => document.addEventListener('authReady', resolve, { once: true }));
      console.log("Chat: authReady diterima.");
  }

  currentUser = window.currentUser; // Ambil user yang sudah login
  
  // (PENTING) auth-guard.js sudah mengamankan halaman ini,
  // tapi kita cek lagi untuk keamanan ganda.
  if (!currentUser) {
       console.error("Auth Guard gagal. User tidak ditemukan.");
       if(chatTranscript) {
         chatTranscript.innerHTML = '<div class="chat-bubble bot">Error: Gagal memverifikasi user. Silakan login kembali.</div>';
       }
       setChatInputDisabled(true);
       return;
  }
  
  console.log("Chat: User terautentikasi:", currentUser.uid);

  const urlParams = new URLSearchParams(window.location.search);
  currentCharacterId = urlParams.get('id') || '1'; 

  // Muat profil (publik) dan riwayat (privat)
  await loadCharacterProfile(currentCharacterId);
  await loadChatHistory(currentCharacterId);
  
  // --- C. Memasang Event Listeners ---
  if (sendButton) {
    sendButton.addEventListener('click', handleSendMessage);
  }
  
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (chatInput.disabled) return; 
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });
  }

  if (backButton) {
    backButton.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }

  if (uploadButton) {
    uploadButton.addEventListener('click', () => {
      fileInput.click(); 
    });
  }
  
  if (fileInput) {
    fileInput.addEventListener('change', handleFileSelected);
  }
});