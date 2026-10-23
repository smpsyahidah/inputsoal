# RuangSoal | SMP Syarif Hidayatullah

Dashboard bank soal SMP Syarif Hidayatullah, Jl. Ki Gede Mayaguna No.01 Pasalakan. Admin mengelola akun serta penugasan guru, sedangkan guru menulis soal pilihan ganda dengan editor TinyMCE.

## Menjalankan aplikasi

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

Halaman login tersedia di [http://localhost:3000/login](http://localhost:3000/login).

## Akun demo


 Admin: `admin` / `admin12345`
 Guru: `nadia` / `guru12345`
 Admin dapat mengatur banyak pasangan mata pelajaran dan tingkat (VII, VIII, IX) untuk setiap guru.
 Naskah soal dan pilihan jawaban mendukung sisipan gambar dari file lokal; gambar ikut diekspor ke Excel.
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
- Data disimpan di `localStorage` browser.

## Batasan

Login dan kata sandi demo hanya untuk prototipe; data serta sesi disimpan di `localStorage` dan tidak memiliki kontrol akses server. Sebelum dipakai sungguhan, hubungkan autentikasi aman, otorisasi berbasis peran, serta database.

TinyMCE berjalan dalam mode GPL. Tinjau persyaratan lisensi TinyMCE sebelum mendistribusikan atau mengubah model lisensi aplikasi.

