# ChatsYok! - Aplikasi Chatbot AI Kustom

ChatsYok! adalah aplikasi web *serverless* yang memungkinkan pengguna untuk mengobrol dengan berbagai persona AI yang disebut **MAI (Model AI)**. Fitur utamanya adalah kemampuan pengguna untuk membuat, merancang, dan membagikan karakter AI mereka sendiri, lengkap dengan kepribadian, sapaan, dan avatar yang unik.

Proyek ini dibangun menggunakan **HTML/CSS/JavaScript** murni di sisi klien, dan ditenagai oleh **Netlify Functions** sebagai backend. Aplikasi ini mengintegrasikan **Google Gemini** untuk pemrosesan bahasa, **Firestore** sebagai database, **Firebase Authentication** untuk autentikasi pengguna, dan **Cloudinary** untuk penyimpanan gambar.

Tema visual aplikasi ini menggunakan palet warna `soft blue` yang nyaman, sesuai dengan preferensi yang telah Anda simpan.

## Fitur Utama

* **Lobi Karakter**: Menampilkan semua MAI publik yang tersedia untuk diajak bicara.
* **Ruang Obrolan Interaktif**: Antarmuka obrolan *real-time* yang memuat riwayat percakapan sebelumnya dari Firestore.
* **Autentikasi Pengguna**: Sistem login, daftar, dan "Masuk dengan Google" yang aman menggunakan Firebase Authentication.
* **Pembuatan MAI (Model AI)**: Pengguna yang sudah login dapat membuat karakter AI mereka sendiri melalui formulir khusus.
* **Kustomisasi Kepribadian**: Pengguna dapat menentukan nama, sapaan, deskripsi singkat (tagline), dan *prompt kepribadian* yang mendetail untuk MAI buatan mereka.
* **Upload Avatar**: Pengguna dapat meng-upload gambar avatar untuk MAI mereka, yang di-hosting melalui Cloudinary.
* **Backend Serverless**: Seluruh logika backend (autentikasi, database, AI) ditangani oleh Netlify Functions.

## Tumpukan Teknologi (Tech Stack)

* **Frontend**: HTML5, CSS3, JavaScript (Vanilla JS)
* **Backend**: Netlify Functions
* **Database**: Google Firestore (via `firebase-admin`)
* **Model AI**: Google Gemini (via `@google/generative-ai` atau REST API)
* **Autentikasi**: Firebase Authentication
* **Penyimpanan File (Avatar)**: Cloudinary
* **Hosting/Deployment**: Netlify

---

## Arsitektur & Alur Kerja

Aplikasi ini beroperasi tanpa server backend tradisional. Semua logika dinamis dikelola oleh Netlify Functions yang dipanggil oleh frontend.

### Logika Sisi Klien (`/js/`)

* **`lobby.js`**:
    * Memanggil fungsi `get-all-characters` saat halaman lobi dimuat.
    * Membangun (me-render) kartu-kartu karakter ke dalam `.character-grid`.
    * Menangani navigasi ke `chat.html` dengan ID karakter yang sesuai.
* **`chat.js`**:
    * Membaca ID karakter dari URL (`?id=...`).
    * Memanggil `get-character` untuk mendapatkan profil AI (termasuk *prompt rahasia* dan nama).
    * Memanggil `get-history` untuk memuat pesan-pesan sebelumnya.
    * Saat pengguna mengirim pesan, pesan tersebut dikirim ke `get-chat-response` bersama dengan *prompt kepribadian*.
    * Menyimpan pesan pengguna dan balasan AI ke database melalui `save-message`.
* **`create-mai.js`**:
    * Menangani formulir pembuatan MAI.
    * Mengambil file gambar, mengubahnya menjadi Base64, dan mengirimkannya ke `upload-image`.
    * Setelah mendapatkan URL gambar dari Cloudinary, ia mengumpulkan semua data formulir (nama, deskripsi, sapaan, dll.) dan mengirimkannya ke `save-mai`.
* **`auth.js`** & **`auth-guard.js`**:
    * Menangani logika login, daftar, dan Google Sign-In di halaman `login.html`.
    * Menjaga status login di seluruh aplikasi, menyembunyikan/menampilkan tombol (seperti "Buat Bot" vs "Login"), dan mengalihkan pengguna yang belum login dari halaman yang dilindungi.

### Logika Sisi Server (`/netlify/functions/`)

* **`get-all-characters.js`**: Mengambil semua dokumen dari koleksi `characters` di Firestore dan mengembalikannya sebagai array.
* **`get-character.js`**: Mengambil satu dokumen karakter berdasarkan ID-nya dari Firestore.
* **`get-history.js`**: Mengambil semua pesan dari sub-koleksi `messages` milik karakter tertentu, diurutkan berdasarkan timestamp.
* **`get-chat-response.js`**:
    * Menerima pesan pengguna dan `characterProfile`.
    * Membungkus keduanya dalam *system prompt* yang dirancang khusus.
    * Mengirimkan prompt gabungan ke Google Gemini API.
    * Mengembalikan balasan teks murni dari AI.
* **`save-message.js`**: Menerima `characterId`, `sender`, dan `text`, lalu menuliskannya sebagai dokumen baru di sub-koleksi `characters/{characterId}/messages`.
* **`save-mai.js`**:
    * Menerima data MAI baru dari klien (`create-mai.js`).
* **`upload-image.js`**:
    * Menerima string gambar Base64.
    * Menggunakan SDK Cloudinary untuk meng-upload gambar ke folder `chatsyok`.
    * Mengembalikan `secure_url` dari gambar yang telah di-upload.

---

## Struktur Proyek