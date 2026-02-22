import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('chatwork-notify: invoked');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('chatwork-notify: no auth header');
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ユーザーのJWTで認証
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    console.log('chatwork-notify: user=', user?.id, 'error=', userError?.message);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', details: userError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { project_id, message } = await req.json();
    console.log('chatwork-notify: project_id=', project_id, 'message length=', message?.length);

    if (!project_id || !message) {
      return new Response(JSON.stringify({ error: 'Missing project_id or message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service Roleでプロジェクト設定を取得
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // メンバーシップ確認
    const { data: membership, error: memberError } = await serviceClient
      .from('project_members')
      .select('role')
      .eq('project_id', project_id)
      .eq('user_id', user.id)
      .single();

    console.log('chatwork-notify: membership=', membership, 'memberError=', memberError?.message);

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not a project member' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Chatwork設定取得
    const { data: settings, error: settingsError } = await serviceClient
      .from('project_settings')
      .select('chatwork_room_id, chatwork_api_token')
      .eq('project_id', project_id)
      .single();

    console.log('chatwork-notify: settings=', settings ? 'found' : 'null', 'roomId=', settings?.chatwork_room_id, 'settingsError=', settingsError?.message);

    const roomId = settings?.chatwork_room_id;
    const apiToken = settings?.chatwork_api_token;

    if (!roomId || !apiToken) {
      console.log('chatwork-notify: skipped - not configured');
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'Chatwork not configured' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Chatwork APIにメッセージ送信
    console.log('chatwork-notify: sending to Chatwork room', roomId);
    const chatworkResponse = await fetch(
      `https://api.chatwork.com/v2/rooms/${roomId}/messages`,
      {
        method: 'POST',
        headers: {
          'X-ChatWorkToken': apiToken,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `body=${encodeURIComponent(message)}`,
      }
    );

    console.log('chatwork-notify: Chatwork response status=', chatworkResponse.status);

    if (!chatworkResponse.ok) {
      const errText = await chatworkResponse.text();
      console.log('chatwork-notify: Chatwork error=', errText);
      return new Response(JSON.stringify({ error: 'Chatwork API error', details: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await chatworkResponse.json();
    console.log('chatwork-notify: success, message_id=', result.message_id);
    return new Response(JSON.stringify({ success: true, message_id: result.message_id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.log('chatwork-notify: exception=', (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
