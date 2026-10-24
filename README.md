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

Untuk proyek baru di Vercel, gunakan integrasi PostgreSQL melalui Vercel Marketplace (misalnya Neon Postgres). Vercel Postgres yang lama sudah tidak tersedia untuk proyek baru.

1. Di Vercel, pilih **Add New → Project**, impor repository GitHub `smpsyahidah/inputsoal`, pertahankan Root Directory `./`, framework Next.js, dan production branch `main`.
2. Buat PostgreSQL melalui [Vercel Marketplace](https://vercel.com/marketplace/neon), lalu hubungkan database ke project. Pilih environment **Production**, **Preview**, dan **Development** sesuai kebutuhan. Jika integrasi menawarkan Preview Branching, aktifkan agar deployment Preview memakai cabang database terpisah.
3. Buka **Project → Settings → Environment Variables** dan pastikan integrasi menyediakan `DATABASE_URL` untuk Production. Jika nama yang dihasilkan berbeda atau ada nama bentrok, sesuaikan prefix integrasi atau isi `DATABASE_URL` dengan connection string PostgreSQL yang valid (gunakan URL pooled bila disediakan).
4. Tambahkan variabel berikut. Tandai kata sandi dan secret sebagai **Secret**; jangan pernah menaruh nilainya di GitHub:

   | Nama | Nilai |
   | --- | --- |
   | `AUTH_SECRET` | Hasil `openssl rand -base64 32` |
   | `RUANGSOAL_ADMIN_USERNAME` | Username admin pilihan Anda |
   | `RUANGSOAL_ADMIN_PASSWORD` | Kata sandi admin unik, minimal 12 karakter |
   | `RUANGSOAL_TEACHER_PASSWORD` | Kata sandi guru unik, minimal 12 karakter |

   Terapkan variabel aplikasi ke **Production** dan **Preview**. Pastikan setiap environment memiliki `DATABASE_URL` yang benar. Hindari memakai URL database lokal `localhost` di Vercel.
5. Jalankan deployment. Periksa `https://<domain-vercel-anda>/api/health`; hasil yang diharapkan adalah `{"ok":true,"database":"connected"}`. Jika gagal, periksa **Deployments → Functions/Logs** dan pastikan `DATABASE_URL` benar.
6. Masuk menggunakan username admin dan kata sandi yang Anda set. Seed akun guru awal (`nadia`, `raka`, `dewi`) memakai `RUANGSOAL_TEACHER_PASSWORD`.

Buat secret dengan:

```bash
openssl rand -base64 32
```

Perubahan environment variable di Vercel baru berlaku setelah deployment baru. Push ke `main` akan memicu deployment Production; branch/PR lain mendapat Preview. Jika integrasi Neon membuat database branch Preview, data Preview terpisah dari Production.

Untuk menjalankan proyek lokal dengan konfigurasi Vercel, tautkan project dan tarik environment Development:

```bash
npx vercel link
npx vercel env pull .env.local
npm run dev
```

Jangan commit `.env.local`. Login demo `admin` / `admin12345` dan kata sandi guru `guru12345` hanya menjadi fallback lokal; kredensial tersebut tidak digunakan di production.

#### Jika deployment belum berfungsi

- `/api/health` mengembalikan `503`: pastikan integrasi PostgreSQL tersambung ke project dan environment Production serta `DATABASE_URL` tersedia.
- Login menampilkan pesan server belum siap: pastikan `AUTH_SECRET` dan ketiga variabel `RUANGSOAL_*` terisi di environment yang sama. Buat deployment baru setelah mengubah variabel.
- Login menampilkan username/kata sandi tidak sesuai: periksa ejaan/case username admin dan role yang dipilih. Untuk guru awal, gunakan username `nadia`, `raka`, atau `dewi` dengan kata sandi guru yang dikonfigurasi.
- Preview berfungsi tetapi Production tidak: pastikan semua variable di atas juga tersedia untuk **Production**; Preview dan Production bisa memakai database berbeda.

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
- Endpoint pemeriksaan koneksi database: `/api/health`.
- Saat admin login pertama kali di browser lama, data `localStorage` yang tersisa akan digabungkan ke database satu kali.

## Batasan

Guru masih memakai satu kata sandi bersama yang ditentukan oleh `RUANGSOAL_TEACHER_PASSWORD`; gunakan sistem akun dengan kata sandi per pengguna sebelum aplikasi digunakan untuk data sensitif. Jika data berubah di browser lain setelah halaman dibuka, aplikasi menolak penyimpanan yang berpotensi menimpa data terbaru; muat ulang halaman untuk mengambil perubahan terkini.

TinyMCE berjalan dalam mode GPL. Tinjau persyaratan lisensi TinyMCE sebelum mendistribusikan atau mengubah model lisensi aplikasi.
