// --- (BAGIAN BARU) Database Karakter ---
// Nanti, ini bisa diambil dari database sungguhan (misal: Firebase)
const characterData = {
    '1': {
        name: 'Profesor Hoot',
        description: 'Seekor burung hantu bijak yang tahu segalanya tentang sejarah dan sains.',
        image: 'https://placehold.co/300x250/bbdefb/1e3a5a?text=Hoot',
        tags: ['Edukasi', 'Sejarah', 'Sains']
    },
    '2': {
        name: 'Koki Bella',
        description: 'Seorang koki ramah yang ahli membuat resep pasta lezat.',
        image: 'https://placehold.co/300x250/f8bbd0/880e4f?text=Bella',
        tags: ['Memasak', 'Resep', 'Italia']
    },
    '3': {
        name: 'Sparky si Robot',
        description: 'Robot penjelajah yang lucu dan penuh rasa ingin tahu tentang teknologi.',
        image: 'https://placehold.co/300x250/d1c4e9/311b92?text=Sparky',
        tags: ['Teknologi', 'Sci-Fi', 'Robot']
    },
    '4': {
        name: 'Kapten Alex',
        description: 'Penjelajah galaksi pemberani yang telah mengunjungi seratus planet.',
        image: 'https://placehold.co/300x250/c8e6c9/1b5e20?text=Alex',
        tags: ['Petualangan', 'Luar Angkasa', 'Fiksi Ilmiah']
    }
    // Tambahkan karakter lain di sini
};

// --- (BAGIAN BARU) Fungsi untuk Memuat Profil Karakter ---
function loadCharacterProfile(id) {
    // Cari karakter di database, atau gunakan '1' (Hoot) sebagai default jika ID tidak ditemukan
    const character = characterData[id] || characterData['1'];

    // Ambil elemen-elemen di panel kiri
    const profileImg = document.querySelector('.chat-left-panel .profile-img');
    const profileName = document.querySelector('.chat-left-panel h4');
    const profileDesc = document.querySelector('.chat-left-panel p');
    const tagsContainer = document.querySelector('.chat-left-panel .tags');

    // Update konten di panel kiri
    if (profileImg) {
        profileImg.src = character.image;
        profileImg.alt = character.name; // Baik untuk aksesibilitas
    }
    if (profileName) profileName.textContent = character.name;
    if (profileDesc) profileDesc.textContent = character.description;
    
    // Update tags
    if (tagsContainer) {
        tagsContainer.innerHTML = ''; // Kosongkan tags yang lama
        character.tags.forEach(tagText => {
            const tagElement = document.createElement('span');
            tagElement.textContent = tagText;
            tagsContainer.appendChild(tagElement);
        });
    }

    // (BAGIAN BARU) Set pesan sapaan bot berdasarkan karakter
    const initialBotMessage = document.querySelector('.chat-bubble.bot');
    if (initialBotMessage) {
        initialBotMessage.textContent = `Halo! Saya ${character.name}. Ada yang bisa saya bantu?`;
    }
}


// --- (BAGIAN INTI) Kode Chat Anda yang Sudah Ada ---
document.addEventListener('DOMContentLoaded', () => {

    // --- (BAGIAN BARU) Logika untuk Membaca URL ---
    // 1. Dapatkan parameter dari URL
    const urlParams = new URLSearchParams(window.location.search);
    // 2. Ambil nilai dari parameter 'id'. Jika tidak ada, gunakan '1' sebagai default.
    const characterId = urlParams.get('id') || '1';

    // 3. Panggil fungsi untuk memuat profil berdasarkan ID
    loadCharacterProfile(characterId);
    
    // --- Sisa Kode Anda (Tidak Berubah) ---
    const chatTranscript = document.getElementById('chat-transcript');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const backButton = document.getElementById('back-btn');

    // --- Fungsi untuk mengirim pesan ---
    function handleSendMessage() {
        const messageText = chatInput.value.trim();
        if (messageText === '') return;
        addMessageToTranscript(messageText, 'user');
        chatInput.value = '';
        simulateBotResponse();
    }

    // --- Fungsi untuk menambahkan bubble chat ---
    function addMessageToTranscript(text, sender) {
        const bubble = document.createElement('div');
        bubble.classList.add('chat-bubble', sender);
        bubble.textContent = text;
        chatTranscript.appendChild(bubble);
        chatTranscript.scrollTop = chatTranscript.scrollHeight;
    }

    // --- Fungsi simulasi balasan Bot ---
    function simulateBotResponse() {
        setTimeout(() => {
            const responses = [
                "Itu sangat menarik! Bisakah Anda jelaskan lebih lanjut?",
                "Maaf, saya ini hanya simulasi. Saya belum terhubung ke API Gemini.",
                "Saya mengerti.",
                "Terima kasih sudah berbagi.",
                "Hmm, coba tanyakan hal lain."
            ];
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            addMessageToTranscript(randomResponse, 'bot');
        }, 1200);
    }

    // --- Event Listeners ---
    sendButton.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // Tombol kembali ini SEKARANG berfungsi!
    backButton.addEventListener('click', () => {
        // Kembali ke halaman lobby
        window.location.href = 'index.html';
    });

});