// Tunggu hingga seluruh konten HTML dimuat
document.addEventListener('DOMContentLoaded', () => {

    // Ambil elemen-elemen yang kita perlukan
    const chatTranscript = document.getElementById('chat-transcript');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const backButton = document.getElementById('back-btn');

    // --- Fungsi untuk mengirim pesan ---
    function handleSendMessage() {
        const messageText = chatInput.value.trim();

        if (messageText === '') {
            return; // Jangan kirim pesan kosong
        }

        // 1. Tampilkan pesan pengguna di transkrip
        addMessageToTranscript(messageText, 'user');

        // 2. Kosongkan input
        chatInput.value = '';

        // 3. Simulasikan balasan bot
        simulateBotResponse();
    }

    // --- Fungsi untuk menambahkan bubble chat ke transkrip ---
    function addMessageToTranscript(text, sender) {
        const bubble = document.createElement('div');
        bubble.classList.add('chat-bubble', sender);
        bubble.textContent = text;
        
        chatTranscript.appendChild(bubble);

        // Auto-scroll ke pesan terbaru
        chatTranscript.scrollTop = chatTranscript.scrollHeight;
    }

    // --- Fungsi untuk simulasi balasan Bot ---
    function simulateBotResponse() {
        // Tunda balasan agar terlihat natural
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
        }, 1200); // Tunda 1.2 detik
    }

    // --- Pasang Event Listeners ---

    // 1. Kirim saat tombol diklik
    sendButton.addEventListener('click', handleSendMessage);

    // 2. Kirim saat menekan 'Enter' (tanpa Shift)
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Mencegah baris baru di textarea
            handleSendMessage();
        }
    });

    // 3. Tombol kembali (saat ini hanya simulasi)
    backButton.addEventListener('click', () => {
        alert('Tombol "Kembali" diklik! (Nanti ini akan kembali ke Lobby)');
        // Nanti Anda bisa ubah ini menjadi:
        // window.location.href = 'index.html'; // (Jika lobby Anda adalah index.html)
    });

});