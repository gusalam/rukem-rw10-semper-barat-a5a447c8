/**
 * Utility untuk standarisasi pesan error dalam Bahasa Indonesia
 * yang mudah dipahami pengguna umum
 */

// Mapping error codes/patterns ke pesan user-friendly
const errorPatterns: Record<string, string> = {
  // Duplikasi data
  'duplicate key': 'Data sudah terdaftar, silakan periksa kembali.',
  'unique constraint': 'Data sudah terdaftar, silakan periksa kembali.',
  'already exists': 'Data sudah terdaftar, silakan periksa kembali.',
  'nik_key': 'NIK sudah terdaftar, silakan gunakan NIK lain.',
  'anggota_nik_key': 'NIK sudah terdaftar, silakan gunakan NIK lain.',
  
  // Validasi KK
  'sudah memiliki kepala keluarga': 'Nomor KK ini sudah memiliki Kepala Keluarga.',
  'kepala keluarga': 'Nomor KK ini sudah memiliki Kepala Keluarga.',
  
  // Akses & Auth
  'unauthorized': 'Anda tidak memiliki akses ke fitur ini.',
  'forbidden': 'Anda tidak memiliki akses ke fitur ini.',
  'access denied': 'Anda tidak memiliki akses ke fitur ini.',
  'jwt expired': 'Sesi Anda telah berakhir. Silakan login kembali.',
  'invalid token': 'Sesi Anda telah berakhir. Silakan login kembali.',
  'invalid login credentials': 'Email atau password salah.',
  'invalid credentials': 'Email atau password salah.',
  
  // Email
  'email already registered': 'Email sudah terdaftar.',
  'user already registered': 'Email sudah terdaftar.',
  'email not confirmed': 'Email belum dikonfirmasi. Silakan cek inbox Anda.',
  
  // Password
  'password should be at least': 'Password minimal 6 karakter.',
  'password is too short': 'Password minimal 6 karakter.',
  
  // Data required
  'null value': 'Data belum lengkap, silakan lengkapi semua isian.',
  'not null': 'Data belum lengkap, silakan lengkapi semua isian.',
  'required': 'Data belum lengkap, silakan lengkapi semua isian.',
  
  // Foreign key / relasi
  'foreign key': 'Data gagal disimpan karena ada data terkait.',
  'violates foreign key': 'Data tidak dapat dihapus karena masih digunakan oleh data lain.',
  'still referenced': 'Data tidak dapat dihapus karena masih digunakan oleh data lain.',
  
  // RLS (Row Level Security)
  'row-level security': 'Anda tidak memiliki akses ke data ini.',
  'new row violates': 'Anda tidak memiliki akses untuk menambah data ini.',
  
  // Network errors
  'network error': 'Koneksi terputus. Silakan periksa koneksi internet Anda.',
  'failed to fetch': 'Koneksi terputus. Silakan periksa koneksi internet Anda.',
  'network request failed': 'Koneksi terputus. Silakan periksa koneksi internet Anda.',
  
  // Storage
  'payload too large': 'Ukuran file terlalu besar. Maksimal 5MB.',
  'file too large': 'Ukuran file terlalu besar. Maksimal 5MB.',
  'invalid file type': 'Jenis file tidak didukung.',
  
  // Rate limiting
  'too many requests': 'Terlalu banyak permintaan. Silakan tunggu beberapa saat.',
  'rate limit': 'Terlalu banyak permintaan. Silakan tunggu beberapa saat.',
};

/**
 * Mengubah pesan error teknis menjadi pesan yang user-friendly
 */
export function getErrorMessage(error: unknown, fallbackMessage?: string): string {
  // Handle null/undefined
  if (!error) {
    return fallbackMessage || 'Terjadi kesalahan, silakan coba beberapa saat lagi.';
  }

  // Get error message string
  let errorString = '';
  
  if (typeof error === 'string') {
    errorString = error;
  } else if (error instanceof Error) {
    errorString = error.message;
  } else if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;
    errorString = String(
      errorObj.message || 
      errorObj.error_description || 
      errorObj.error || 
      errorObj.msg || 
      JSON.stringify(error)
    );
  } else {
    errorString = String(error);
  }

  // Normalize to lowercase for matching
  const lowerError = errorString.toLowerCase();

  // Check against known patterns
  for (const [pattern, message] of Object.entries(errorPatterns)) {
    if (lowerError.includes(pattern.toLowerCase())) {
      return message;
    }
  }

  // Return fallback or cleaned error
  return fallbackMessage || 'Terjadi kesalahan, silakan coba beberapa saat lagi.';
}

/**
 * Pesan standar untuk berbagai kondisi
 */
export const StandardMessages = {
  // Success messages
  success: {
    save: 'Data berhasil disimpan.',
    update: 'Data berhasil diperbarui.',
    delete: 'Data berhasil dihapus.',
    upload: 'File berhasil diupload.',
    login: 'Login berhasil! Selamat datang kembali.',
    logout: 'Anda telah keluar dari sistem.',
    createAccount: 'Akun berhasil dibuat.',
    
    // Specific success messages
    anggota: {
      add: 'Anggota baru berhasil ditambahkan ke sistem.',
      update: 'Data anggota berhasil diperbarui.',
      delete: 'Anggota berhasil dihapus dari sistem.',
      createAccount: 'Akun login untuk anggota berhasil dibuat. Anggota dapat login menggunakan email dan password yang didaftarkan.',
    },
    iuran: {
      add: 'Iuran berhasil ditambahkan.',
      update: 'Data iuran berhasil diperbarui.',
      delete: 'Iuran berhasil dihapus.',
      generate: (count: number, periode: string) => `${count} iuran berhasil dibuat untuk periode ${periode}.`,
      verify: 'Pembayaran berhasil diverifikasi. Status iuran telah diperbarui menjadi lunas.',
      reject: 'Pembayaran ditolak. Anggota akan diminta untuk melakukan pembayaran ulang.',
    },
    kas: {
      add: 'Transaksi kas berhasil dicatat.',
      update: 'Transaksi kas berhasil diperbarui.',
      delete: 'Transaksi kas berhasil dihapus.',
    },
    kematian: {
      add: 'Data kematian berhasil dicatat. Santunan akan segera diproses.',
      update: 'Data kematian berhasil diperbarui.',
    },
    santunan: {
      process: 'Santunan berhasil diproses dan dicatat ke kas.',
      distribute: 'Santunan berhasil disalurkan kepada ahli waris.',
    },
    pengaturan: {
      save: 'Pengaturan sistem berhasil disimpan.',
    },
    profil: {
      update: 'Profil Anda berhasil diperbarui.',
    },
    notifikasi: {
      read: 'Notifikasi telah ditandai sebagai sudah dibaca.',
      readAll: 'Semua notifikasi telah ditandai sebagai sudah dibaca.',
    },
    pembayaran: {
      submit: 'Bukti pembayaran berhasil dikirim. Silakan tunggu verifikasi dari admin.',
    },
  },
  
  // Error messages
  error: {
    save: 'Data gagal disimpan, silakan coba lagi.',
    update: 'Data gagal diperbarui, silakan coba lagi.',
    delete: 'Data gagal dihapus, silakan coba lagi.',
    load: 'Gagal memuat data, silakan coba lagi.',
    upload: 'Gagal upload file, silakan coba lagi.',
    network: 'Koneksi terputus. Silakan periksa koneksi internet Anda.',
    system: 'Terjadi kesalahan, silakan coba beberapa saat lagi.',
    access: 'Anda tidak memiliki akses ke fitur ini.',
    session: 'Sesi Anda telah berakhir. Silakan login kembali.',
  },
  
  // Validation messages
  validation: {
    required: 'Data belum lengkap, silakan lengkapi semua isian.',
    email: 'Format email tidak valid.',
    phone: 'Nomor HP tidak valid.',
    nik: 'NIK harus 16 digit.',
    kk: 'Nomor KK harus 16 digit.',
    password: 'Password minimal 6 karakter.',
    duplicate: 'Data sudah terdaftar, silakan periksa kembali.',
    nikDuplicate: 'NIK sudah terdaftar, silakan gunakan NIK lain.',
    kkKepala: 'Nomor KK ini sudah memiliki Kepala Keluarga.',
  },
  
  // Confirmation messages
  confirm: {
    logout: 'Apakah Anda yakin ingin keluar?',
    delete: 'Apakah Anda yakin ingin menghapus data ini?',
    deleteWarning: 'Data yang dihapus tidak dapat dikembalikan.',
    cancel: 'Apakah Anda yakin ingin membatalkan?',
    unsavedChanges: 'Ada perubahan yang belum disimpan. Yakin ingin keluar?',
  },
} as const;
