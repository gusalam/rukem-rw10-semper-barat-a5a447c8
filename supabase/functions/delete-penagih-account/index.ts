import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify caller using the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(JSON.stringify({ error: 'Sesi tidak valid. Silakan login ulang.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Create a client with the user's token to verify their session
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    
    const { data: { user: callerUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !callerUser) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Sesi tidak valid. Silakan login ulang.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Caller verified:', callerUser.id, callerUser.email);

    // Check if caller is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      console.error('Role check failed:', roleError);
      return new Response(JSON.stringify({ error: 'Anda tidak memiliki izin untuk menghapus akun penagih. Hanya Admin yang dapat melakukan ini.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { penagih_user_id, penagih_id } = await req.json();
    
    if (!penagih_user_id || !penagih_id) {
      return new Response(JSON.stringify({ error: 'ID penagih tidak valid.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Deleting penagih account: user_id=${penagih_user_id}, penagih_id=${penagih_id}`);

    // Check if penagih exists
    const { data: penagihData, error: penagihError } = await supabaseAdmin
      .from('penagih')
      .select('*')
      .eq('id', penagih_id)
      .maybeSingle();

    if (penagihError || !penagihData) {
      console.error('Penagih not found:', penagihError);
      return new Response(JSON.stringify({ error: 'Data penagih tidak ditemukan.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store penagih data for audit log before deletion
    const penagihDataForAudit = { ...penagihData };

    // ============================================
    // STEP 1: Delete wilayah assignments
    // ============================================
    console.log('Step 1: Deleting wilayah assignments...');
    const { error: deleteWilayahError } = await supabaseAdmin
      .from('penagih_wilayah')
      .delete()
      .eq('penagih_user_id', penagih_user_id);

    if (deleteWilayahError) {
      console.error('Delete wilayah error:', deleteWilayahError);
      // Continue - not critical for deletion
    } else {
      console.log('Step 1 completed: Wilayah deleted');
    }

    // ============================================
    // STEP 2: Delete user role (penagih)
    // ============================================
    console.log('Step 2: Deleting user role...');
    const { error: deleteRoleError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', penagih_user_id)
      .eq('role', 'penagih');

    if (deleteRoleError) {
      console.error('Delete role error:', deleteRoleError);
      // Continue - not critical
    } else {
      console.log('Step 2 completed: Role deleted');
    }

    // ============================================
    // STEP 3: Delete penagih record from penagih table
    // ============================================
    console.log('Step 3: Deleting penagih record...');
    const { error: deletePenagihError } = await supabaseAdmin
      .from('penagih')
      .delete()
      .eq('id', penagih_id);

    if (deletePenagihError) {
      console.error('Delete penagih error:', deletePenagihError);
      return new Response(JSON.stringify({ error: 'Gagal menghapus data penagih dari database.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('Step 3 completed: Penagih record deleted');

    // ============================================
    // STEP 4: Delete profile record
    // ============================================
    console.log('Step 4: Deleting profile record...');
    const { error: deleteProfileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', penagih_user_id);

    if (deleteProfileError) {
      console.error('Delete profile error:', deleteProfileError);
      // Continue - not critical
    } else {
      console.log('Step 4 completed: Profile deleted');
    }

    // ============================================
    // STEP 4.5: Nullify penagih_user_id in iuran_pembayaran
    // (Keep transaction data for audit, but remove user reference)
    // ============================================
    console.log('Step 4.5: Nullifying penagih references in iuran_pembayaran...');
    const { error: nullifyPembayaranError } = await supabaseAdmin
      .from('iuran_pembayaran')
      .update({ penagih_user_id: null })
      .eq('penagih_user_id', penagih_user_id);

    if (nullifyPembayaranError) {
      console.error('Nullify pembayaran error:', nullifyPembayaranError);
      // Continue - will try to delete auth user anyway
    } else {
      console.log('Step 4.5 completed: Pembayaran references nullified');
    }

    // ============================================
    // STEP 5: Delete from Supabase Auth (PERMANENT)
    // ============================================
    console.log('Step 5: Deleting from Supabase Auth...');
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(
      penagih_user_id
    );

    if (deleteAuthError) {
      console.error('Delete auth user error:', deleteAuthError);
      return new Response(JSON.stringify({ error: 'Gagal menghapus akun login penagih. Silakan coba lagi atau hubungi administrator.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('Step 5 completed: Auth user deleted');

    // ============================================
    // STEP 6: Log to audit
    // ============================================
    console.log('Step 6: Creating audit log...');
    try {
      await supabaseAdmin.from('audit_log').insert({
        user_id: callerUser.id,
        aksi: 'delete_permanent',
        tabel: 'penagih',
        record_id: penagih_id,
        data_lama: penagihDataForAudit,
        data_baru: null,
      });
      console.log('Step 6 completed: Audit log created');
    } catch (auditError) {
      console.error('Audit log error:', auditError);
      // Don't fail the operation for audit log error
    }

    console.log('Penagih account permanently deleted:', penagih_user_id);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Akun penagih ${penagihDataForAudit.nama_lengkap} berhasil dihapus permanen. Data transaksi tetap tersimpan untuk keperluan audit.`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan';
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Terjadi kesalahan saat menghapus akun. Silakan hubungi administrator.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
