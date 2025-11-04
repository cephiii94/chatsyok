// File: js/chat.js (Lengkap dan Diperbarui dengan 'keydown')

// Variabel global untuk menyimpan profil bot yang sedang aktif
let currentChatbotProfile = "";
let currentCharacterId = "1"; 

async function loadCharacterProfile(characterId) {
  console.log(`Mencoba memuat karakter ID: ${characterId} dari server...`);
  const functionUrl = `/.netlify/functions/get-character?id=${characterId}`;

  try {
    const response = await fetch(functionUrl);
    if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
    
    const character = await response.json();
    console.log("Data karakter diterima:", character);

    // Simpan profil ke variabel global
    currentChatbotProfile = character.description; 
    
    // Memuat data ke Halaman (Panel Kiri)
    const profileImg = document.querySelector('.chat-left-panel .profile-img');
    const profileName = document.querySelector('.chat-left-panel h4');
    const profileDesc = document.querySelector('.chat-left-panel p');
    const tagsContainer = document.querySelector('.chat-left-panel .tags');

    if (profileImg) profileImg.src = character.image;
    if (profileName) profileName.textContent = character.name;
    if (profileDesc) profileDesc.textContent = character.description;
    
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

    const initialBotMessage = document.querySelector('.chat-bubble.bot');
    if (initialBotMessage) {
      initialBotMessage.textContent = `Halo! Saya ${character.name}. Ada yang bisa saya bantu?`;
    }

  } catch (error) {
    console.error("Error mengambil data karakter:", error);
    const profileName = document.querySelector('.chat-left-panel h4');
    if (profileName) profileName.textContent = "Gagal memuat";
  }
}

// --- Logika Utama Saat Halaman Dimuat ---
document.addEventListener('DOMContentLoaded', () => {

  const urlParams = new URLSearchParams(window.location.search);
  currentCharacterId = urlParams.get('id') || '1'; // Update ID global

  loadCharacterProfile(currentCharacterId);
  
  const chatTranscript = document.getElementById('chat-transcript');
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-button');
  const backButton = document.getElementById('back-btn');

  // --- Fungsi untuk mengirim pesan ---
  async function handleSendMessage() {
    const messageText = chatInput.value.trim();
    if (messageText === '' || !currentChatbotProfile) return; 

    addMessageToTranscript(messageText, 'user');
    chatInput.value = ''; 
    chatInput.disabled = true; 
    sendButton.disabled = true;

    // Tampilkan indikator "mengetik"
    const typingBubble = addMessageToTranscript("...", 'bot');
    typingBubble.classList.add('typing'); 

    try {
      // Panggil Netlify Function AI baru Anda
      const response = await fetch('/.netlify/functions/get-chat-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: messageText,
          characterProfile: currentChatbotProfile 
        })
      });

      if (!response.ok) throw new Error("Gagal mendapat balasan dari server");
      
      const data = await response.json();
      
      typingBubble.textContent = data.reply;
      typingBubble.classList.remove('typing');

    } catch (error) {
      console.error("Error saat mengirim chat:", error);
      typingBubble.textContent = "Maaf, saya sedang mengalami gangguan.";
      typingBubble.classList.remove('typing');
    } finally {
      // Aktifkan kembali input
      chatInput.disabled = false;
      sendButton.disabled = false;
      chatInput.focus();
    }
  }

  // --- Fungsi untuk menambahkan bubble chat ---
  function addMessageToTranscript(text, sender) {
    const bubble = document.createElement('div');
    bubble.classList.add('chat-bubble', sender);
    bubble.textContent = text;
    chatTranscript.appendChild(bubble);
    chatTranscript.scrollTop = chatTranscript.scrollHeight;
    return bubble; 
  }

  
  // --- Event Listeners ---
  sendButton.addEventListener('click', handleSendMessage);

  // ▼▼▼ PERBAIKAN DI SINI ▼▼▼
  // Mengganti 'keypress' menjadi 'keydown'
  chatInput.addEventListener('keydown', (e) => {
    // Jangan kirim jika input sedang dinonaktifkan (bot sedang berpikir)
    if (chatInput.disabled) return; 
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Mencegah baris baru
      handleSendMessage();
    }
  });

  backButton.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
});