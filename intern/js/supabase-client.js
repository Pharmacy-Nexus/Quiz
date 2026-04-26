(function () {
  'use strict';

  const SUPABASE_URL = 'https://cfijltppbutzvcpjynux.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_3_UlM-GT9Kccjdp4P_NBew_eIKbCWK_';

  if (!window.supabase) {
    console.error('Supabase library is not loaded.');
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  window.InternSupabase = client;
})();
