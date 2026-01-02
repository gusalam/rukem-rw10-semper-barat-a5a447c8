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
      return new Response(JSON.stringify({ error: 'Data penagih tidak ditemukan.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Set penagih status to inactive
    const { error: updatePenagihError } = await supabaseAdmin
      .from('penagih')
      .update({ status_aktif: false })
      .eq('id', penagih_id);

    if (updatePenagihError) {
      console.error('Update penagih error:', updatePenagihError);
      return new Response(JSON.stringify({ error: 'Gagal menonaktifkan penagih.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Remove wilayah assignments (but keep transaction history)
    const { error: deleteWilayahError } = await supabaseAdmin
      .from('penagih_wilayah')
      .delete()
      .eq('penagih_user_id', penagih_user_id);

    if (deleteWilayahError) {
      console.error('Delete wilayah error:', deleteWilayahError);
      // Continue anyway - not critical
    }

    // Step 3: Remove user role (so they can't login anymore as penagih)
    const { error: deleteRoleError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', penagih_user_id)
      .eq('role', 'penagih');

    if (deleteRoleError) {
      console.error('Delete role error:', deleteRoleError);
      // Continue anyway
    }

    // Step 4: Disable the auth user (soft delete - keeps the user but can't login)
    // We use updateUser with banned_until set to a far future date
    const { error: banUserError } = await supabaseAdmin.auth.admin.updateUserById(
      penagih_user_id,
      { 
        ban_duration: '876000h' // ~100 years
      }
    );

    if (banUserError) {
      console.error('Ban user error:', banUserError);
      // Continue anyway - penagih already deactivated
    }

    console.log('Penagih account deleted successfully:', penagih_user_id);

    // Log to audit
    try {
      await supabaseAdmin.from('audit_log').insert({
        user_id: callerUser.id,
        aksi: 'delete',
        tabel: 'penagih',
        record_id: penagih_id,
        data_lama: penagihData,
        data_baru: null,
      });
    } catch (auditError) {
      console.error('Audit log error:', auditError);
      // Don't fail the operation for audit log error
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Akun penagih ${penagihData.nama_lengkap} berhasil dihapus. Data transaksi tetap tersimpan.`
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
