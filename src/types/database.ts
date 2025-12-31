export type AppRole = 'admin' | 'anggota' | 'penagih';
export type StatusAnggota = 'aktif' | 'nonaktif' | 'meninggal';
export type StatusTagihan = 'belum_bayar' | 'menunggu_admin' | 'lunas';
export type StatusPembayaranTagihan = 'menunggu_admin' | 'disetujui' | 'ditolak';
export type JenisKas = 'pemasukan' | 'pengeluaran';
export type MetodePembayaran = 'tunai' | 'transfer' | 'qris';
export type StatusSantunan = 'pending' | 'diproses' | 'disalurkan';

export interface Pengaturan {
  id: string;
  nama_rukem: string;
  nominal_iuran: number;
  periode_iuran: string;
  nominal_santunan: number;
  aturan_tunggakan: string | null;
  nama_bank: string | null;
  nomor_rekening: string | null;
  nama_pemilik_rekening: string | null;
  qris_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Anggota {
  id: string;
  user_id: string | null;
  nama_lengkap: string;
  nik: string;
  no_kk: string;
  alamat: string;
  no_hp: string;
  tanggal_lahir: string | null;
  jenis_kelamin: string | null;
  tempat_lahir: string | null;
  agama: string | null;
  status_perkawinan: string | null;
  pekerjaan: string | null;
  hubungan_kk: string | null;
  rt: string | null;
  rw: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  kabupaten_kota: string | null;
  provinsi: string | null;
  status: StatusAnggota;
  tanggal_bergabung: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface KeluargaAnggota {
  id: string;
  anggota_id: string;
  nama: string;
  hubungan: string;
  tanggal_lahir: string | null;
  created_at: string;
}

// New tagihan system (per KK)
export interface IuranTagihan {
  id: string;
  no_kk: string;
  periode: string;
  nominal: number;
  status: StatusTagihan;
  jatuh_tempo: string;
  keterangan: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  kepala_keluarga?: Anggota;
}

// New pembayaran system (with penagih)
export interface IuranPembayaran {
  id: string;
  tagihan_id: string;
  penagih_user_id: string;
  tanggal_bayar: string;
  nominal: number;
  metode: MetodePembayaran;
  bukti_url: string | null;
  catatan: string | null;
  status: StatusPembayaranTagihan;
  approved_by: string | null;
  approved_at: string | null;
  alasan_tolak: string | null;
  created_at: string;
  updated_at: string;
  tagihan?: IuranTagihan;
}

export interface PenagihWilayah {
  id: string;
  penagih_user_id: string;
  rt: string;
  rw: string;
  created_at: string;
}

export interface Kas {
  id: string;
  jenis: JenisKas;
  nominal: number;
  keterangan: string;
  referensi_id: string | null;
  referensi_tipe: string | null;
  created_by: string;
  created_at: string;
}

export interface Kematian {
  id: string;
  anggota_id: string;
  tanggal_meninggal: string;
  tempat_meninggal: string | null;
  penyebab: string | null;
  keterangan: string | null;
  status_iuran_terakhir: string | null;
  tunggakan_total: number;
  created_by: string;
  created_at: string;
  anggota?: Anggota;
}

export interface Santunan {
  id: string;
  kematian_id: string;
  anggota_id: string;
  nominal_dasar: number;
  potongan_tunggakan: number;
  nominal_akhir: number;
  status: StatusSantunan;
  tanggal_penyaluran: string | null;
  metode: MetodePembayaran | null;
  penerima: string | null;
  bukti_url: string | null;
  catatan: string | null;
  processed_by: string | null;
  created_at: string;
  updated_at: string;
  kematian?: Kematian;
  anggota?: Anggota;
}

export interface Notifikasi {
  id: string;
  user_id: string;
  judul: string;
  pesan: string;
  dibaca: boolean;
  created_at: string;
}
