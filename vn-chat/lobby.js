// Data Karakter
const characters = [
    {
        id: "1",
        name: "BRI",
        image: "img/char/bri/idle.png", // Menggunakan aset bri untuk MAI
        description: "Teman masa kecil yang ceria dan penuh energi. Selalu ada untuk mendengarkan ceritamu.",
        status: "online",
        locked: false
    },
    {
        id: "2",
        name: "YUNA",
        image: "https://placehold.co/400x600/1a1a2e/FFF?text=Coming+Soon", // Placeholder
        description: "Gadis misterius yang suka membaca buku di perpustakaan lama.",
        status: "offline",
        locked: true
    },
    {
        id: "3",
        name: "REI",
        image: "https://placehold.co/400x600/1a1a2e/FFF?text=Locked", // Placeholder
        description: "Ketua OSIS yang tegas tapi sebenarnya perhatian.",
        status: "offline",
        locked: true
    }
];

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('character-grid');

    characters.forEach((char, index) => {
        const card = document.createElement('div');
        card.className = `char-card ${char.locked ? 'locked' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`; // Staggered animation

        // Handle click event
        if (!char.locked) {
            card.addEventListener('click', () => {
                // Navigasi ke chat.html dengan parameter ID
                window.location.href = `chat.html?id=${char.id}`;
            });
        }

        const statusLabel = char.locked ? 'LOCKED' : (char.status === 'online' ? 'ONLINE' : 'OFFLINE');
        const statusColor = char.locked ? '#7f8c8d' : (char.status === 'online' ? '#4cd137' : '#95a5a6');

        card.innerHTML = `
            <div class="char-image-wrapper">
                <img src="${char.image}" alt="${char.name}" class="char-image">
                <div class="status-badge" style="background: ${statusColor}">${statusLabel}</div>
            </div>
            <div class="char-info">
                <h2 class="char-name">${char.name}</h2>
                <p class="char-desc">${char.description}</p>
            </div>
        `;

        grid.appendChild(card);
    });
});
