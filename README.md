# RuangSoal | SMP Syarif Hidayatullah

Dashboard bank soal SMP Syarif Hidayatullah, Jl. Ki Gede Mayaguna No.01 Pasalakan. Admin mengelola akun serta penugasan guru, sedangkan guru menulis soal pilihan ganda dengan editor TinyMCE.

## Menjalankan aplikasi

### PostgreSQL lokal dengan Docker

Pastikan Docker Desktop/Engine aktif, lalu jalankan:

```bash
docker compose up -d
cp .env.example .env.local
```

Buat secret sesi dan ganti nilai `AUTH_SECRET` di `.env.local` dengan hasil perintah:

```bash
openssl rand -base64 32
```

Tabel serta data awal aplikasi akan dibuat otomatis ketika login pertama kali. Data PostgreSQL lokal tetap ada di volume Docker `ruangsoal-postgres`, termasuk setelah container dihentikan. Untuk menghentikan database tanpa menghapus datanya:

```bash
docker compose down
```

Jangan gunakan `docker compose down -v` kecuali memang ingin menghapus seluruh data database lokal.

### Database untuk deployment

Siapkan database PostgreSQL yang dapat diakses oleh server aplikasi, lalu atur variabel lingkungan berikut di platform hosting:

```env
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
AUTH_SECRET=secret-random-minimal-32-karakter
```

Buat secret dengan:

```bash
openssl rand -base64 32
```

Gunakan database PostgreSQL dan `AUTH_SECRET` yang sama pada seluruh instance aplikasi agar sesi dan data konsisten antar-browser. Tabel dan data awal dibuat otomatis saat API pertama kali diakses.

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

Halaman login tersedia di [http://localhost:3000/login](http://localhost:3000/login).

## Akun demo


Admin: `admin` / `admin12345`

Guru: `nadia` / `guru12345`

Admin dapat mengatur banyak pasangan mata pelajaran dan tingkat (VII, VIII, IX) untuk setiap guru. Naskah soal dan pilihan jawaban mendukung sisipan gambar dari file lokal; gambar ikut diekspor ke Excel.

Ganti kredensial demo sebelum aplikasi digunakan sungguhan.

```bash
npm run lint
npm run build
```

## Fitur prototipe

- Editor TinyMCE self-hosted tersedia di `public/tinymce`.
- Data contoh mencakup soal dan tiga akun guru.
- Login demo membedakan peran Admin dan Guru.
- Admin dapat mengatur banyak pasangan mata pelajaran dan tingkat (VII, VIII, IX) untuk setiap guru.
- Guru dapat memilih penugasan aktif dan membuat, mengubah, mencari, memfilter, serta menghapus soal untuk pasangan mapel-tingkat tersebut.
- Naskah soal dan pilihan jawaban mendukung sisipan gambar.
- Admin dapat mengunduh `.xlsx` dengan kolom `No`, `Soal`, `Jawaban A`, `Jawaban B`, `Jawaban C`, `Jawaban D`, `Jawaban Benar`, `Mata Pelajaran`, dan `Tingkat`.
- Data soal dan akun guru disimpan di PostgreSQL, sehingga dapat diakses dari browser berbeda yang terhubung ke aplikasi/database yang sama.
- Sesi login memakai cookie HTTP-only; `AUTH_SECRET` harus sama pada seluruh instance aplikasi.
- Saat admin login pertama kali di browser lama, data `localStorage` yang tersisa akan digabungkan ke database satu kali.

## Batasan

Kredensial login masih berupa akun demo dengan kata sandi bersama untuk guru. Ganti kredensial dan tambahkan mekanisme pengelolaan kata sandi sebelum dipakai sungguhan. Jika data berubah di browser lain setelah halaman dibuka, aplikasi menolak penyimpanan yang berpotensi menimpa data terbaru; muat ulang halaman untuk mengambil perubahan terkini.

TinyMCE berjalan dalam mode GPL. Tinjau persyaratan lisensi TinyMCE sebelum mendistribusikan atau mengubah model lisensi aplikasi.
