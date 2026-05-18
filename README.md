# 🔐 Account Manager

![Account Manager Banner](https://via.placeholder.com/1200x400/0a0a0f/6366f1?text=Account+Manager)

**Account Manager** adalah sebuah sistem Progressive Web App (PWA) yang dibangun untuk mengelola peminjaman dan penggunaan akun premium secara bersama di dalam tim (khususnya untuk tim Sosial Media & Multimedia). Sistem ini memastikan tidak ada bentrok penggunaan akun berkat fitur **Check-in / Check-out** secara real-time.

---

## ✨ Fitur Utama

- 🔄 **Real-Time Synchronization**: Status akun (sedang digunakan atau tersedia) tersinkronisasi secara real-time di semua perangkat anggota tim menggunakan Supabase Realtime.
- 📱 **Progressive Web App (PWA)**: Dapat diinstal di perangkat mobile (Android/iOS) maupun desktop untuk pengalaman seperti aplikasi native.
- ⏳ **Manajemen Langganan Premium**: Melacak tanggal kedaluwarsa langganan akun premium dan memberikan peringatan otomatis jika akun akan segera habis masa aktifnya.
- 🛡️ **Admin Panel**: Panel khusus untuk mengelola (menambah, mengedit, menghapus) kredensial akun, hanya dapat diakses oleh pengguna dengan role Admin.
- 📜 **Riwayat Penggunaan (History Logs)**: Melacak siapa yang menggunakan akun, kapan mulai (check-in), dan kapan selesai (check-out).
- 🎨 **Premium UI/UX**: Tampilan gelap (Dark Mode) modern yang estetik dengan animasi yang halus dan desain responsif.

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES Modules)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **PWA**: `vite-plugin-pwa`
- **Backend/Database**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, Realtime)

## 🚀 Instalasi & Menjalankan Secara Lokal

Ikuti langkah-langkah di bawah ini untuk menjalankan proyek ini di komputer Anda:

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (versi 16 atau terbaru)
- Akun [Supabase](https://supabase.com/)

### 2. Clone Repository
```bash
git clone https://github.com/Fernandoalf06/account-manager.git
cd account-manager
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Setup Environment Variables
Buat file `.env` di root direktori proyek Anda (Anda dapat menyalin dari `.env.example` jika ada) dan isi dengan URL dan Key dari Supabase Anda:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 5. Setup Supabase Database
Pastikan Anda memiliki tabel-tabel berikut di database Supabase Anda:
- `accounts`: Untuk menyimpan data akun (nama layanan, email, password, status, waktu expired, dll).
- `history_logs`: Untuk mencatat log aktivitas peminjaman akun.
- (Opsional) Mengaktifkan fitur **Row Level Security (RLS)** dan **Realtime** di tabel `accounts` dan `history_logs`.

### 6. Jalankan Development Server
```bash
npm run dev
```
Aplikasi akan berjalan secara lokal. Buka browser dan akses URL yang diberikan oleh Vite (biasanya `http://localhost:5173`).

---

## 📦 Build untuk Produksi

Untuk melakukan kompilasi aplikasi untuk keperluan produksi (production):

```bash
npm run build
```
File hasil build akan berada di dalam folder `dist/`. Anda dapat mem-preview hasil build dengan perintah:

```bash
npm run preview
```

---

## 🤝 Kontribusi

Jika Anda ingin berkontribusi pada proyek ini, silakan lakukan fork pada repository ini dan buat pull request dengan fitur atau perbaikan bug yang Anda buat.

## 📄 Lisensi

Proyek ini dibuat untuk keperluan internal tim. Hak cipta dilindungi.
