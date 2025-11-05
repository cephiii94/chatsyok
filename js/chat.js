// File: js/chat.js (Struktur Scope Diperbaiki)

// === 1. GLOBAL VARIABLES ===
let currentChatbotProfile = "";
let currentCharacterName = "";
let currentCharacterGreeting = ""; // <-- MODIFIKASI: Ditambahkan
let currentCharacterId = "1"; 

// --- Variabel untuk Elemen DOM ---
let chatTranscript;
let chatInput;
let sendButton;
let uploadButton;
let fileInput;
let backButton;


// === 2. FUNGSI UTAMA (GLOBAL) ===

/**
 * Memuat profil karakter dari server Netlify.
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

    // ▼▼▼ MODIFIKASI DI SINI ▼▼▼
    currentChatbotProfile = character.description; 
    currentCharacterName = character.name; 
    currentCharacterGreeting = character.greeting; // <-- SIMPAN SAPAAN
    // ▼▼▼ AKHIR MODIFIKASI ▼▼▼
    
    // Memuat data ke Panel Kiri
    const profileImg = document.querySelector('.chat-left-panel .profile-img');
    const profileName = document.querySelector('.chat-left-panel h4');
    const profileDesc = document.querySelector('.chat-left-panel p');
    const tagsContainer = document.querySelector('.chat-left-panel .tags');

    if (profileImg) profileImg.src = character.image;
    if (profileName) profileName.textContent = character.name;
    // ▼▼▼ MODIFIKASI DI SINI ▼▼▼
    // Tampilkan 'tagline' di panel kiri, BUKAN deskripsi rahasia
    if (profileDesc) profileDesc.textContent = character.tagline || character.description;
    // ▼▼▼ AKHIR MODIFIKASI ▼▼▼
    
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
 */
async function loadChatHistory(characterId) {
  console.log(`Memuat riwayat obrolan untuk ID: ${characterId}`);
  try {
    const response = await fetch(`/.netlify/functions/get-history?id=${characterId}`);
    if (!response.ok) throw new Error("Gagal mengambil riwayat.");
    
    const history = await response.json();

    const initialBotMessage = document.querySelector('.chat-bubble.bot');
    if (history.length > 0 && initialBotMessage) {
      chatTranscript.innerHTML = ''; // Kosongkan transkrip jika ada riwayat
    }

    // Tampilkan semua riwayat pesan (SEKARANG BERHASIL)
    history.forEach(message => {
      addMessageToTranscript(message.text, message.sender);
    });

    // Jika TIDAK ada riwayat, set sapaan bot
    if (history.length === 0 && initialBotMessage) {
      // ▼▼▼ MODIFIKASI DI SINI ▼▼▼
      // Gunakan sapaan kustom. Jika tidak ada, buat sapaan default.
      initialBotMessage.textContent = currentCharacterGreeting || `Halo! Saya ${currentCharacterName || "Bot"}. Ada yang bisa saya bantu?`;
      // ▼▼▼ AKHIR MODIFIKASI ▼▼▼
    }

  } catch (error) {
    console.error("Error memuat riwayat:", error);
  }
}

/**
 * Menyimpan satu pesan ke database.
 */
async function saveMessage(sender, text) {
  // (Tidak berubah)
  fetch('/.netlify/functions/save-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      characterId: currentCharacterId,
      sender: sender,
      text: text
    })
  }).catch(error => {
    console.error("Gagal menyimpan pesan ke DB:", error);
  });
}

/**
 * Menangani pengiriman pesan TEKS.
 */
async function handleSendMessage() {
  const messageText = chatInput.value.trim();
  
  // (Tidak berubah dari sebelumnya)
  if (messageText === '' || !currentChatbotProfile || !currentCharacterName || chatInput.disabled) return; 

  addMessageToTranscript(messageText, 'user');
  saveMessage('user', messageText); // Simpan pesan pengguna
  
  chatInput.value = ''; 
  setChatInputDisabled(true); 

  const typingBubble = addMessageToTranscript("...", 'bot', 'typing');

  try {
    const response = await fetch('/.netlify/functions/get-chat-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      
      // (Tidak berubah dari sebelumnya)
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
    
    saveMessage('bot', data.reply); // Simpan balasan bot

  } catch (error) {
    console.error("Error saat mengirim chat:", error);
    typingBubble.textContent = `Maaf, terjadi error: ${error.message}`;
    typingBubble.classList.remove('typing');
  } finally {
    setChatInputDisabled(false); 
  }
}

/**
 * Menangani pengiriman GAMBAR.
 */
async function handleFileSelected(event) {
  // (Tidak berubah)
  const file = event.target.files[0];
  if (!file) return;

  const uploadBubble = addMessageToTranscript("Meng-upload gambar...", 'user', 'uploading');
  setChatInputDisabled(true);

  try {
    const fileBase64 = await readFileAsBase64(file);
    
    const response = await fetch('/.netlify/functions/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: fileBase64 })
    });

    if (!response.ok) throw new Error("Gagal meng-upload file ke server.");

    const data = await response.json();
    const secureUrl = data.secure_url;

    chatTranscript.removeChild(uploadBubble);
    addMessageWithImage(secureUrl, 'user');
    
    saveMessage('user', secureUrl); // Simpan URL gambar
    
    // Respons bot (sementara)
    const typingBubble = addMessageToTranscript("...", 'bot', 'typing');
    typingBubble.textContent = "Wah, gambar yang bagus!";
    typingBubble.classList.remove('typing');
    saveMessage('bot', typingBubble.textContent); 
    
  } catch (error) {
    console.error("Error saat upload gambar:", error);
    uploadBubble.textContent = "Gagal meng-upload gambar.";
    uploadBubble.classList.remove('uploading');
  } finally {
    setChatInputDisabled(false);
    event.target.value = null;
  }
}


// === 3. FUNGSI PEMBANTU (GLOBAL) ===

/**
 * Mengubah status area input (aktif/nonaktif).
 */
function setChatInputDisabled(disabled) {
  // (Tidak berubah)
  if (chatInput) chatInput.disabled = disabled;
  if (sendButton) sendButton.disabled = disabled;
  if (uploadButton) uploadButton.disabled = disabled;
}

/**
 * Membaca file sebagai string Base64.
 */
function readFileAsBase64(file) {
  // (Tidak berubah)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Menambahkan bubble chat GAMBAR ke transkrip.
 */
function addMessageWithImage(imageUrl, sender) {
  // (Tidak berubah)
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

/**
 * Menambahkan bubble chat TEKS ke transkrip.
 */
function addMessageToTranscript(text, sender, extraClass = null) {
  // (Tidak berubah)
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


// === 4. TITIK MASUK APLIKASI ===
document.addEventListener('DOMContentLoaded', async () => {
  
  // --- A. Mengisi variabel elemen DOM ---
  chatTranscript = document.getElementById('chat-transcript');
  chatInput = document.getElementById('chat-input');
  sendButton = document.getElementById('send-button');
  backButton = document.getElementById('back-btn');
  uploadButton = document.getElementById('upload-btn');
  fileInput = document.getElementById('file-input');

  // --- B. Logika Startup ---
  const urlParams = new URLSearchParams(window.location.search);
  currentCharacterId = urlParams.get('id') || '1'; 

  // (Tidak berubah dari sebelumnya)
  // Pastikan profil (dan nama) dimuat SEBELUM riwayat,
  await loadCharacterProfile(currentCharacterId);
  await loadChatHistory(currentCharacterId);
  
  // --- C. Memasang Event Listeners ---
  sendButton.addEventListener('click', handleSendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (chatInput.disabled) return; 
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  backButton.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  uploadButton.addEventListener('click', () => {
    fileInput.click(); 
  });
  
  fileInput.addEventListener('change', handleFileSelected);
});