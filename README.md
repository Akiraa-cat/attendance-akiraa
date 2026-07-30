Panduan singkat

1. Clone repository
   git clone https://github.com/Akiraa-cat/attendance-akiraa.git
   cd attendance-akiraa
   code .

2. Siapkan Google Apps Script
   - Buat spreadsheet baru di Google Drive
   - Buka Extensions > Apps Script
   - Hapus isi file Code.gs
   - Salin isi Code.gs dari repository
   - Simpan perubahan

3. Deploy Apps Script sebagai Web App
   - Pilih Deploy > New deployment
   - Pilih tipe Web App
   - Atur konfigurasi:
     Description: Version 1.0
     Execute as: Me
     Who has access: Anyone
   - Deploy dan lanjutkan proses authorize jika diminta
   - Salin URL hasil deploy yang berakhir dengan /exec

4. Konfigurasi Vercel
   - Pastikan file proxy tersedia di folder api/proxy.js
   - Set environment variable SCRIPT_URL dengan URL Apps Script yang sudah didapat
   - Push perubahan ke GitHub lalu lakukan redeploy di Vercel

5. Selesai
   Setelah frontend dan backend terhubung, aplikasi siap digunakan.
