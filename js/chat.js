// File: js/chat.js (Lengkap + Fitur Upload Gambar)

// Variabel global
let currentChatbotProfile = "";
let currentCharacterId = "1"; 

// --- 1. FUNGSI MEMUAT PROFIL ---
async function loadCharacterProfile(characterId) {
  console.log(`Mencoba memuat karakter ID: ${characterId} dari server...`);
  const functionUrl = `/.netlify/functions/get-character?id=${characterId}`;
  try {
    const response = await fetch(functionUrl);
    if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
    const character = await response.json();
    console.log("Data karakter diterima:", character);

    currentChatbotProfile = character.description; 
    
    // Memuat data ke Panel Kiri
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

// --- 2. LOGIKA UTAMA SAAT HALAMAN DIMUAT ---
document.addEventListener('DOMContentLoaded', () => {

  // Muat Profil
  const urlParams = new URLSearchParams(window.location.search);
  currentCharacterId = urlParams.get('id') || '1';
  loadCharacterProfile(currentCharacterId);
  
  // Ambil Elemen-Elemen
  const chatTranscript = document.getElementById('chat-transcript');
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-button');
  const backButton = document.getElementById('back-btn');
  
  // (BARU) Ambil Elemen Upload
  const uploadButton = document.getElementById('upload-btn');
  const fileInput = document.getElementById('file-input');

  // --- 3. FUNGSI-FUNGSI CHAT ---

  // Fungsi kirim pesan TEKS
  async function handleSendMessage() {
    const messageText = chatInput.value.trim();
    if (messageText === '' || !currentChatbotProfile) return; 
    
    addMessageToTranscript(messageText, 'user');
    chatInput.value = ''; 
    setChatInputDisabled(true); // Nonaktifkan input

    // Tampilkan indikator "mengetik"
    const typingBubble = addMessageToTranscript("...", 'bot', 'typing');

    try {
      // Panggil Netlify Function AI
      const response = await fetch('/.netlify/functions/get-chat-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: messageText,
          characterProfile: currentChatbotProfile 
        })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Gagal mendapat balasan dari server");
      }
      
      const data = await response.json();
      typingBubble.textContent = data.reply; // Ganti "..." dengan balasan AI
      typingBubble.classList.remove('typing');
      
    } catch (error) {
      console.error("Error saat mengirim chat:", error);
      typingBubble.textContent = `Maaf, terjadi error: ${error.message}`;
      typingBubble.classList.remove('typing');
    } finally {
      setChatInputDisabled(false); // Aktifkan input kembali
    }
  }

  // (BARU) Fungsi saat file dipilih
  async function handleFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Tampilkan bubble "Meng-upload..."
    const uploadBubble = addMessageToTranscript("Meng-upload gambar...", 'user', 'uploading');
    setChatInputDisabled(true);

    try {
      // 1. Baca file sebagai Base64
      const fileBase64 = await readFileAsBase64(file);
      
      // 2. Kirim ke Netlify Function 'upload-image'
      const response = await fetch('/.netlify/functions/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: fileBase64 })
      });

      if (!response.ok) {
        throw new Error("Gagal meng-upload file ke server.");
      }

      const data = await response.json();
      const secureUrl = data.secure_url;

      // 3. Hapus bubble "Meng-upload..."
      chatTranscript.removeChild(uploadBubble);

      // 4. Tampilkan gambar di chat
      addMessageWithImage(secureUrl, 'user');
      
      // 5. (Opsional) Kirim URL gambar ke Bot untuk direspons
      // Di sini kita bisa panggil handleSendMessage
      // dengan pesan khusus seperti "Ini gambar yang saya kirim"
      // Untuk saat ini, kita anggap bot belum bisa merespons gambar

    } catch (error) {
      console.error("Error saat upload gambar:", error);
      uploadBubble.textContent = "Gagal meng-upload gambar.";
      uploadBubble.classList.remove('uploading');
    } finally {
      setChatInputDisabled(false);
      // Reset input file agar bisa upload file yang sama lagi
      event.target.value = null;
    }
  }

  // (BARU) Fungsi pembantu untuk menonaktifkan/mengaktifkan area input
  function setChatInputDisabled(disabled) {
    chatInput.disabled = disabled;
    sendButton.disabled = disabled;
    uploadButton.disabled = disabled;
  }

  // (BARU) Fungsi pembantu untuk membaca file
  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  // (BARU) Fungsi untuk menambah bubble chat GAMBAR
  function addMessageWithImage(imageUrl, sender) {
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
  
  // (DIMODIFIKASI) Fungsi untuk menambah bubble chat TEKS
  function addMessageToTranscript(text, sender, extraClass = null) {
    const bubble = document.createElement('div');
    bubble.classList.add('chat-bubble', sender);
    if (extraClass) bubble.classList.add(extraClass);
    
    bubble.textContent = text; // Tetap set teks
    
    chatTranscript.appendChild(bubble);
    chatTranscript.scrollTop = chatTranscript.scrollHeight;
    return bubble; 
  }

  
  // --- 4. EVENT LISTENERS ---
  
  // Kirim (Teks)
  sendButton.addEventListener('click', handleSendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (chatInput.disabled) return; 
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  // Kembali
  backButton.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  // (BARU) Upload (Gambar)
  uploadButton.addEventListener('click', () => {
    fileInput.click(); // Memicu input file yang tersembunyi
  });
  fileInput.addEventListener('change', handleFileSelected);

});