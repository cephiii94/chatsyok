// File: js/chat.js (Lengkap dan Diperbarui)

// Variabel global untuk menyimpan profil bot yang sedang aktif
let currentChatbotProfile = "";
let currentCharacterId = "1"; // Simpan ID untuk penggunaan di masa depan (misal: simpan chat history)

// --- Fungsi untuk Memuat Profil Karakter (Sedikit Modifikasi) ---
async function loadCharacterProfile(characterId) {
  console.log(`Mencoba memuat karakter ID: ${characterId} dari server...`);
  const functionUrl = `/.netlify/functions/get-character?id=${characterId}`;

  try {
    const response = await fetch(functionUrl);
    if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
    
    const character = await response.json();
    console.log("Data karakter diterima:", character);

    // --- (MODIFIKASI) Simpan profil ke variabel global ---
    currentChatbotProfile = character.description; // INI PENTING!
    
    // --- Memuat data ke Halaman (Panel Kiri) ---
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
    // Tampilkan error di panel
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

  // --- (MODIFIKASI) Fungsi untuk mengirim pesan ---
  async function handleSendMessage() {
    const messageText = chatInput.value.trim();
    if (messageText === '' || !currentChatbotProfile) return; // Jangan kirim jika profil belum dimuat

    addMessageToTranscript(messageText, 'user');
    chatInput.value = ''; // Kosongkan input
    chatInput.disabled = true; // Nonaktifkan input saat bot berpikir
    sendButton.disabled = true;

    // Tampilkan indikator "mengetik"
    const typingBubble = addMessageToTranscript("...", 'bot');
    typingBubble.classList.add('typing'); // Tambah kelas untuk styling (opsional)

    try {
      // Panggil Netlify Function AI baru Anda
      const response = await fetch('/.netlify/functions/get-chat-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: messageText,
          characterProfile: currentChatbotProfile // Kirim profil yang disimpan
        })
      });

      if (!response.ok) throw new Error("Gagal mendapat balasan dari server");
      
      const data = await response.json();
      
      // Hapus "..." dan ganti dengan balasan AI
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

  // --- (MODIFIKASI) Fungsi untuk menambahkan bubble chat ---
  function addMessageToTranscript(text, sender) {
    const bubble = document.createElement('div');
    bubble.classList.add('chat-bubble', sender);
    bubble.textContent = text;
    chatTranscript.appendChild(bubble);
    chatTranscript.scrollTop = chatTranscript.scrollHeight;
    return bubble; // Kembalikan elemen bubble (berguna untuk indikator 'typing')
  }

  // --- HAPUS FUNGSI simulateBotResponse() ---
  // Kita tidak memerlukannya lagi
  
  // --- Event Listeners (Tidak Berubah) ---
  sendButton.addEventListener('click', handleSendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });
  backButton.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
});