# Pengumuman V1

Pengumuman adalah feed seluruh anggota GPdI Elshaddai. Owner/admin membuat
draft, mengedit, menerbitkan atau menarik publikasi, menyematkan beberapa item,
memberi tanggal kedaluwarsa Jakarta, dan mengarsipkan. Arsip dapat dipulihkan
sebagai draft tetapi tidak ada hard delete dari aplikasi.

Satu pengumuman berisi judul, isi plain text, dan satu tautan HTTPS opsional.
Tidak ada attachment, rich text, target per-role/per-ibadah, publish terjadwal,
push notification, badge belum dibaca, komentar, atau read receipt pada V1.

## Akses dan lifecycle

- Member aktif, termasuk permanent Song Bank editor, hanya membaca item yang
  sudah diterbitkan, belum diarsipkan, dan belum melewati `expires_on` menurut
  tanggal Asia/Jakarta.
- Owner/admin membaca seluruh draft, terbit, kedaluwarsa, dan arsip. Hanya
  owner/admin yang dapat menyimpan konten atau menjalankan transisi lifecycle.
- Publish/unpublish/archive/restore memakai RPC bertimestamp server. Hak update
  client tidak mencakup kolom status dan tabel tidak memberikan hak `DELETE`.
- Restore selalu menghasilkan draft. Edit pada item terbit langsung terlihat
  dan memperbarui `updated_at`; V1 tidak menyimpan revision history.

## Offline

Snapshot terenkripsi V2 menyimpan feed aktif saja, termasuk tautan untuk
dibaca tetapi tidak dibuka tanpa internet. Draft/arsip tidak pernah dicache,
termasuk untuk admin. Pembacaan cache memeriksa kedaluwarsa lagi terhadap hari
Jakarta saat itu. Storage V1 dibersihkan dan data perlu disegarkan online.

## Validasi

Migration `202610030025_announcements.sql` dan optimasi
`202610040026_announcement_performance.sql` diterapkan pada project pSalmo.
`supabase/tests/announcements.sql` menguji role/church boundary, lifecycle,
expiry, pinning, HTTPS, dan larangan hard delete di dalam transaksi rollback.
Unit tests mencakup input, kalender Jakarta, ordering/Home limit, dan snapshot
V2. Pemeriksaan UI pada HP tetap mengikuti `device-validation.md`.
