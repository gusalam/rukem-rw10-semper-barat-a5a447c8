export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      anggota: {
        Row: {
          agama: string | null
          alamat: string
          avatar_url: string | null
          created_at: string
          hubungan_kk: string | null
          id: string
          jenis_kelamin: string | null
          kabupaten_kota: string | null
          kecamatan: string | null
          kelurahan: string | null
          nama_lengkap: string
          nik: string
          no_hp: string
          no_kk: string
          pekerjaan: string | null
          provinsi: string | null
          rt: string | null
          rw: string | null
          status: Database["public"]["Enums"]["status_anggota"]
          status_perkawinan: string | null
          tanggal_bergabung: string
          tanggal_lahir: string | null
          tempat_lahir: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agama?: string | null
          alamat: string
          avatar_url?: string | null
          created_at?: string
          hubungan_kk?: string | null
          id?: string
          jenis_kelamin?: string | null
          kabupaten_kota?: string | null
          kecamatan?: string | null
          kelurahan?: string | null
          nama_lengkap: string
          nik: string
          no_hp: string
          no_kk: string
          pekerjaan?: string | null
          provinsi?: string | null
          rt?: string | null
          rw?: string | null
          status?: Database["public"]["Enums"]["status_anggota"]
          status_perkawinan?: string | null
          tanggal_bergabung?: string
          tanggal_lahir?: string | null
          tempat_lahir?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agama?: string | null
          alamat?: string
          avatar_url?: string | null
          created_at?: string
          hubungan_kk?: string | null
          id?: string
          jenis_kelamin?: string | null
          kabupaten_kota?: string | null
          kecamatan?: string | null
          kelurahan?: string | null
          nama_lengkap?: string
          nik?: string
          no_hp?: string
          no_kk?: string
          pekerjaan?: string | null
          provinsi?: string | null
          rt?: string | null
          rw?: string | null
          status?: Database["public"]["Enums"]["status_anggota"]
          status_perkawinan?: string | null
          tanggal_bergabung?: string
          tanggal_lahir?: string | null
          tempat_lahir?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          aksi: string
          created_at: string
          data_baru: Json | null
          data_lama: Json | null
          id: string
          record_id: string | null
          tabel: string
          user_id: string | null
        }
        Insert: {
          aksi: string
          created_at?: string
          data_baru?: Json | null
          data_lama?: Json | null
          id?: string
          record_id?: string | null
          tabel: string
          user_id?: string | null
        }
        Update: {
          aksi?: string
          created_at?: string
          data_baru?: Json | null
          data_lama?: Json | null
          id?: string
          record_id?: string | null
          tabel?: string
          user_id?: string | null
        }
        Relationships: []
      }
      iuran: {
        Row: {
          anggota_id: string
          created_at: string
          id: string
          jatuh_tempo: string
          jenis: Database["public"]["Enums"]["jenis_iuran"]
          keterangan: string | null
          no_kk: string | null
          nominal: number
          periode: string
          status: Database["public"]["Enums"]["status_iuran"]
          updated_at: string
        }
        Insert: {
          anggota_id: string
          created_at?: string
          id?: string
          jatuh_tempo: string
          jenis?: Database["public"]["Enums"]["jenis_iuran"]
          keterangan?: string | null
          no_kk?: string | null
          nominal: number
          periode: string
          status?: Database["public"]["Enums"]["status_iuran"]
          updated_at?: string
        }
        Update: {
          anggota_id?: string
          created_at?: string
          id?: string
          jatuh_tempo?: string
          jenis?: Database["public"]["Enums"]["jenis_iuran"]
          keterangan?: string | null
          no_kk?: string | null
          nominal?: number
          periode?: string
          status?: Database["public"]["Enums"]["status_iuran"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iuran_anggota_id_fkey"
            columns: ["anggota_id"]
            isOneToOne: false
            referencedRelation: "anggota"
            referencedColumns: ["id"]
          },
        ]
      }
      iuran_pembayaran: {
        Row: {
          alasan_tolak: string | null
          approved_at: string | null
          approved_by: string | null
          bukti_url: string | null
          catatan: string | null
          created_at: string
          id: string
          metode: Database["public"]["Enums"]["metode_pembayaran"]
          nominal: number
          penagih_user_id: string
          status: Database["public"]["Enums"]["status_pembayaran_tagihan"]
          tagihan_id: string
          tanggal_bayar: string
          updated_at: string
        }
        Insert: {
          alasan_tolak?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bukti_url?: string | null
          catatan?: string | null
          created_at?: string
          id?: string
          metode?: Database["public"]["Enums"]["metode_pembayaran"]
          nominal: number
          penagih_user_id: string
          status?: Database["public"]["Enums"]["status_pembayaran_tagihan"]
          tagihan_id: string
          tanggal_bayar?: string
          updated_at?: string
        }
        Update: {
          alasan_tolak?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bukti_url?: string | null
          catatan?: string | null
          created_at?: string
          id?: string
          metode?: Database["public"]["Enums"]["metode_pembayaran"]
          nominal?: number
          penagih_user_id?: string
          status?: Database["public"]["Enums"]["status_pembayaran_tagihan"]
          tagihan_id?: string
          tanggal_bayar?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iuran_pembayaran_tagihan_id_fkey"
            columns: ["tagihan_id"]
            isOneToOne: false
            referencedRelation: "iuran_tagihan"
            referencedColumns: ["id"]
          },
        ]
      }
      iuran_tagihan: {
        Row: {
          created_at: string
          created_by: string
          id: string
          jatuh_tempo: string
          keterangan: string | null
          no_kk: string
          nominal: number
          periode: string
          status: Database["public"]["Enums"]["status_tagihan"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          jatuh_tempo: string
          keterangan?: string | null
          no_kk: string
          nominal: number
          periode: string
          status?: Database["public"]["Enums"]["status_tagihan"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          jatuh_tempo?: string
          keterangan?: string | null
          no_kk?: string
          nominal?: number
          periode?: string
          status?: Database["public"]["Enums"]["status_tagihan"]
          updated_at?: string
        }
        Relationships: []
      }
      kas: {
        Row: {
          created_at: string
          created_by: string
          id: string
          jenis: Database["public"]["Enums"]["jenis_kas"]
          keterangan: string
          nominal: number
          referensi_id: string | null
          referensi_tipe: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          jenis: Database["public"]["Enums"]["jenis_kas"]
          keterangan: string
          nominal: number
          referensi_id?: string | null
          referensi_tipe?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          jenis?: Database["public"]["Enums"]["jenis_kas"]
          keterangan?: string
          nominal?: number
          referensi_id?: string | null
          referensi_tipe?: string | null
        }
        Relationships: []
      }
      keluarga_anggota: {
        Row: {
          anggota_id: string
          created_at: string
          hubungan: string
          id: string
          nama: string
          tanggal_lahir: string | null
        }
        Insert: {
          anggota_id: string
          created_at?: string
          hubungan: string
          id?: string
          nama: string
          tanggal_lahir?: string | null
        }
        Update: {
          anggota_id?: string
          created_at?: string
          hubungan?: string
          id?: string
          nama?: string
          tanggal_lahir?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "keluarga_anggota_anggota_id_fkey"
            columns: ["anggota_id"]
            isOneToOne: false
            referencedRelation: "anggota"
            referencedColumns: ["id"]
          },
        ]
      }
      kematian: {
        Row: {
          anggota_id: string
          created_at: string
          created_by: string
          id: string
          keterangan: string | null
          penyebab: string | null
          status_iuran_terakhir: string | null
          tanggal_meninggal: string
          tempat_meninggal: string | null
          tunggakan_total: number | null
        }
        Insert: {
          anggota_id: string
          created_at?: string
          created_by: string
          id?: string
          keterangan?: string | null
          penyebab?: string | null
          status_iuran_terakhir?: string | null
          tanggal_meninggal: string
          tempat_meninggal?: string | null
          tunggakan_total?: number | null
        }
        Update: {
          anggota_id?: string
          created_at?: string
          created_by?: string
          id?: string
          keterangan?: string | null
          penyebab?: string | null
          status_iuran_terakhir?: string | null
          tanggal_meninggal?: string
          tempat_meninggal?: string | null
          tunggakan_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kematian_anggota_id_fkey"
            columns: ["anggota_id"]
            isOneToOne: true
            referencedRelation: "anggota"
            referencedColumns: ["id"]
          },
        ]
      }
      notifikasi: {
        Row: {
          created_at: string
          dibaca: boolean | null
          id: string
          judul: string
          pesan: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dibaca?: boolean | null
          id?: string
          judul: string
          pesan: string
          user_id: string
        }
        Update: {
          created_at?: string
          dibaca?: boolean | null
          id?: string
          judul?: string
          pesan?: string
          user_id?: string
        }
        Relationships: []
      }
      pembayaran_iuran: {
        Row: {
          alasan_tolak: string | null
          anggota_id: string
          bukti_url: string | null
          catatan: string | null
          created_at: string
          id: string
          iuran_id: string
          metode: Database["public"]["Enums"]["metode_pembayaran"]
          nominal: number
          tanggal_bayar: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          alasan_tolak?: string | null
          anggota_id: string
          bukti_url?: string | null
          catatan?: string | null
          created_at?: string
          id?: string
          iuran_id: string
          metode?: Database["public"]["Enums"]["metode_pembayaran"]
          nominal: number
          tanggal_bayar?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          alasan_tolak?: string | null
          anggota_id?: string
          bukti_url?: string | null
          catatan?: string | null
          created_at?: string
          id?: string
          iuran_id?: string
          metode?: Database["public"]["Enums"]["metode_pembayaran"]
          nominal?: number
          tanggal_bayar?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pembayaran_iuran_anggota_id_fkey"
            columns: ["anggota_id"]
            isOneToOne: false
            referencedRelation: "anggota"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembayaran_iuran_iuran_id_fkey"
            columns: ["iuran_id"]
            isOneToOne: false
            referencedRelation: "iuran"
            referencedColumns: ["id"]
          },
        ]
      }
      penagih_wilayah: {
        Row: {
          created_at: string
          id: string
          penagih_user_id: string
          rt: string
          rw: string
        }
        Insert: {
          created_at?: string
          id?: string
          penagih_user_id: string
          rt: string
          rw: string
        }
        Update: {
          created_at?: string
          id?: string
          penagih_user_id?: string
          rt?: string
          rw?: string
        }
        Relationships: []
      }
      pengaturan: {
        Row: {
          aturan_tunggakan: string | null
          created_at: string
          id: string
          nama_bank: string | null
          nama_pemilik_rekening: string | null
          nama_rukem: string
          nominal_iuran: number
          nominal_santunan: number
          nomor_rekening: string | null
          periode_iuran: string
          qris_url: string | null
          updated_at: string
        }
        Insert: {
          aturan_tunggakan?: string | null
          created_at?: string
          id?: string
          nama_bank?: string | null
          nama_pemilik_rekening?: string | null
          nama_rukem?: string
          nominal_iuran?: number
          nominal_santunan?: number
          nomor_rekening?: string | null
          periode_iuran?: string
          qris_url?: string | null
          updated_at?: string
        }
        Update: {
          aturan_tunggakan?: string | null
          created_at?: string
          id?: string
          nama_bank?: string | null
          nama_pemilik_rekening?: string | null
          nama_rukem?: string
          nominal_iuran?: number
          nominal_santunan?: number
          nomor_rekening?: string | null
          periode_iuran?: string
          qris_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      santunan: {
        Row: {
          anggota_id: string
          bukti_url: string | null
          catatan: string | null
          created_at: string
          id: string
          kematian_id: string
          metode: Database["public"]["Enums"]["metode_pembayaran"] | null
          nominal_akhir: number
          nominal_dasar: number
          penerima: string | null
          potongan_tunggakan: number | null
          processed_by: string | null
          status: Database["public"]["Enums"]["status_santunan"]
          tanggal_penyaluran: string | null
          updated_at: string
        }
        Insert: {
          anggota_id: string
          bukti_url?: string | null
          catatan?: string | null
          created_at?: string
          id?: string
          kematian_id: string
          metode?: Database["public"]["Enums"]["metode_pembayaran"] | null
          nominal_akhir: number
          nominal_dasar: number
          penerima?: string | null
          potongan_tunggakan?: number | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["status_santunan"]
          tanggal_penyaluran?: string | null
          updated_at?: string
        }
        Update: {
          anggota_id?: string
          bukti_url?: string | null
          catatan?: string | null
          created_at?: string
          id?: string
          kematian_id?: string
          metode?: Database["public"]["Enums"]["metode_pembayaran"] | null
          nominal_akhir?: number
          nominal_dasar?: number
          penerima?: string | null
          potongan_tunggakan?: number | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["status_santunan"]
          tanggal_penyaluran?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "santunan_anggota_id_fkey"
            columns: ["anggota_id"]
            isOneToOne: false
            referencedRelation: "anggota"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "santunan_kematian_id_fkey"
            columns: ["kematian_id"]
            isOneToOne: true
            referencedRelation: "kematian"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_anggota_id: { Args: { _user_id: string }; Returns: string }
      get_anggota_no_kk: { Args: { _user_id: string }; Returns: string }
      get_penagih_wilayah: {
        Args: { _user_id: string }
        Returns: {
          rt: string
          rw: string
        }[]
      }
      get_saldo_kas: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_penagih_for_kk: {
        Args: { _no_kk: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "anggota" | "penagih"
      jenis_iuran: "bulanan" | "per_kejadian" | "darurat"
      jenis_kas: "pemasukan" | "pengeluaran"
      metode_pembayaran: "tunai" | "transfer" | "qris"
      status_anggota: "aktif" | "nonaktif" | "meninggal"
      status_iuran: "belum_bayar" | "menunggu_verifikasi" | "lunas" | "ditolak"
      status_pembayaran_tagihan: "menunggu_admin" | "disetujui" | "ditolak"
      status_santunan: "pending" | "diproses" | "disalurkan"
      status_tagihan: "belum_bayar" | "menunggu_admin" | "lunas"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "anggota", "penagih"],
      jenis_iuran: ["bulanan", "per_kejadian", "darurat"],
      jenis_kas: ["pemasukan", "pengeluaran"],
      metode_pembayaran: ["tunai", "transfer", "qris"],
      status_anggota: ["aktif", "nonaktif", "meninggal"],
      status_iuran: ["belum_bayar", "menunggu_verifikasi", "lunas", "ditolak"],
      status_pembayaran_tagihan: ["menunggu_admin", "disetujui", "ditolak"],
      status_santunan: ["pending", "diproses", "disalurkan"],
      status_tagihan: ["belum_bayar", "menunggu_admin", "lunas"],
    },
  },
} as const
