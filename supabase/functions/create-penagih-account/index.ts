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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Sesi tidak valid. Silakan login ulang.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !callerUser) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Sesi tidak valid. Silakan login ulang.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if caller is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      console.error('Role check failed:', roleError);
      return new Response(JSON.stringify({ error: 'Anda tidak memiliki izin untuk membuat akun penagih. Hanya Admin yang dapat melakukan ini.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { email, password, nama_lengkap, rt, rw } = await req.json();
    
    // Validate required fields with specific error messages
    if (!nama_lengkap || nama_lengkap.trim() === '') {
      return new Response(JSON.stringify({ error: 'Nama lengkap wajib diisi.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!email || email.trim() === '') {
      return new Response(JSON.stringify({ error: 'Email wajib diisi.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: 'Format email tidak valid. Contoh: penagih@email.com' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!password) {
      return new Response(JSON.stringify({ error: 'Password wajib diisi.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password minimal 8 karakter.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!rt) {
      return new Response(JSON.stringify({ error: 'Wilayah RT wajib dipilih.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!rw) {
      return new Response(JSON.stringify({ error: 'Wilayah RW wajib dipilih.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Creating penagih account: ${email}, nama: ${nama_lengkap}, RT: ${rt}, RW: ${rw}`);

    // Check if email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());
    if (emailExists) {
      return new Response(JSON.stringify({ error: 'Email sudah digunakan oleh akun lain. Gunakan email yang berbeda.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create user with admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: nama_lengkap.trim(),
      },
    });

    if (createError) {
      console.error('Create user error:', createError);
      
      // Translate common errors to Indonesian
      let errorMessage = 'Gagal membuat akun. Silakan coba lagi.';
      const errMsg = createError.message.toLowerCase();
      
      if (errMsg.includes('email') && errMsg.includes('already')) {
        errorMessage = 'Email sudah digunakan oleh akun lain. Gunakan email yang berbeda.';
      } else if (errMsg.includes('password') && errMsg.includes('weak')) {
        errorMessage = 'Password terlalu lemah. Gunakan kombinasi huruf dan angka.';
      } else if (errMsg.includes('invalid') && errMsg.includes('email')) {
        errorMessage = 'Format email tidak valid.';
      }
      
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User created:', newUser.user.id);

    // Add penagih role
    const { error: insertRoleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        role: 'penagih',
      });

    if (insertRoleError) {
      console.error('Insert role error:', insertRoleError);
      // Rollback: delete the created user
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: 'Gagal menyimpan data role. Silakan coba lagi.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: newUser.user.id,
        full_name: nama_lengkap.trim(),
      });

    if (profileError) {
      console.error('Create profile error:', profileError);
      // Continue anyway - profile trigger might have created it
    }

    // Add penagih record
    const { error: penagihError } = await supabaseAdmin
      .from('penagih')
      .insert({
        user_id: newUser.user.id,
        nama_lengkap: nama_lengkap.trim(),
        email: email.trim().toLowerCase(),
        status_aktif: true,
      });

    if (penagihError) {
      console.error('Insert penagih error:', penagihError);
      // Rollback
      await supabaseAdmin.from('user_roles').delete().eq('user_id', newUser.user.id);
      await supabaseAdmin.from('profiles').delete().eq('user_id', newUser.user.id);
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: 'Gagal menyimpan data penagih. Silakan coba lagi.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Add wilayah
    const { error: wilayahError } = await supabaseAdmin
      .from('penagih_wilayah')
      .insert({
        penagih_user_id: newUser.user.id,
        rt: rt,
        rw: rw,
      });

    if (wilayahError) {
      console.error('Insert wilayah error:', wilayahError);
      // Rollback
      await supabaseAdmin.from('penagih').delete().eq('user_id', newUser.user.id);
      await supabaseAdmin.from('user_roles').delete().eq('user_id', newUser.user.id);
      await supabaseAdmin.from('profiles').delete().eq('user_id', newUser.user.id);
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: 'Gagal menyimpan wilayah. Silakan coba lagi.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Penagih account created successfully:', newUser.user.id);

    return new Response(JSON.stringify({ 
      success: true, 
      user_id: newUser.user.id,
      message: `Akun penagih ${nama_lengkap} untuk wilayah RT ${rt}/RW ${rw} berhasil dibuat.`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan';
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Terjadi kesalahan saat membuat akun. Silakan hubungi administrator.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
