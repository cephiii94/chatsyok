document.addEventListener('DOMContentLoaded', () => {

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
