/* * CATATAN PENTING:
 * Kode ini mengasumsikan Anda telah menambahkan skrip Firebase SDK
 * dan menginisialisasi variabel 'db' (database) di file chat.html Anda.
 * * Kita akan menggunakan sintaks modular Firebase v9+
 */

// Dapatkan fungsi-fungsi yang kita butuhkan dari SDK
const { getDoc, doc } = firebase.firestore;

// --- (BARU) Fungsi untuk Memuat Profil Karakter dari Firestore ---
// Kita mengubahnya menjadi fungsi 'async' agar bisa 'await' (menunggu) data
async function loadCharacterProfile(characterId) {
    console.log(`Mencoba memuat karakter ID: ${characterId}`);
    
    // Tentukan referensi dokumen (doc ref)
    // Ini seperti membuat alamat ke dokumen yang kita inginkan
    const docRef = doc(db, "characters", characterId);

    try {
        // 'getDoc' adalah perintah untuk mengambil data dokumen tersebut
        const docSnap = await getDoc(docRef);

        let character;

        if (docSnap.exists()) {
            // Jika dokumen ada, ambil datanya
            character = docSnap.data();
            console.log("Data karakter ditemukan:", character);
        } else {
            // Jika ID tidak ada (misal: user mengetik chat.html?id=99)
            // Kita bisa memuat data default (karakter '1')
            console.warn("ID karakter tidak ditemukan, memuat default (ID: 1)...");
            const defaultRef = doc(db, "characters", "1");
            const defaultSnap = await getDoc(defaultRef);
            if (defaultSnap.exists()) {
                character = defaultSnap.data();
            } else {
                // Kasus langka: bahkan default pun tidak ada
                console.error("Data karakter default (ID: 1) tidak ditemukan!");
                return; // Hentikan fungsi jika data dasar tidak ada
            }
        }

        // --- Memuat data ke Halaman (kode ini sama seperti sebelumnya) ---
        const profileImg = document.querySelector('.chat-left-panel .profile-img');
        const profileName = document.querySelector('.chat-left-panel h4');
        const profileDesc = document.querySelector('.chat-left-panel p');
        const tagsContainer = document.querySelector('.chat-left-panel .tags');

        if (profileImg) {
            profileImg.src = character.image;
            profileImg.alt = character.name;
        }
        if (profileName) profileName.textContent = character.name;
        if (profileDesc) profileDesc.textContent = character.description;
        
        if (tagsContainer) {
            tagsContainer.innerHTML = ''; 
            // Pastikan 'tags' ada dan merupakan array sebelum di-loop
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
        // Tampilkan pesan error jika gagal terhubung ke Firebase
        const profileName = document.querySelector('.chat-left-panel h4');
        if (profileName) profileName.textContent = "Gagal memuat";
        const profileDesc = document.querySelector('.chat-left-panel p');
        if (profileDesc) profileDesc.textContent = "Tidak dapat terhubung ke database. Pastikan koneksi internet dan konfigurasi Firebase Anda benar.";
    }
}


// --- (BAGIAN INTI) Kode Chat Anda ---
document.addEventListener('DOMContentLoaded', () => {

    // --- (BERUBAH) Logika untuk Membaca URL ---
    // Kita panggil fungsi 'loadCharacterProfile' langsung
    const urlParams = new URLSearchParams(window.location.search);
    const characterId = urlParams.get('id') || '1'; // Default ke '1'

    // Panggil fungsi async yang baru.
    // Kita tidak perlu 'await' di sini karena DOMContentLoaded
    // tidak perlu menunggunya selesai untuk memasang listener lain.
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

    // Tombol kembali
    backButton.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
});