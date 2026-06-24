import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { destinataire_id, titre, corps, url, conversation_id } = await req.json()

    webpush.setVapidDetails(
      Deno.env.get('VAPID_CONTACT')!,
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!
    )

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('utilisateur_id', destinataire_id)

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, reason: 'no_subscriptions' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payload = JSON.stringify({
      title: titre || 'LocaSyn',
      body: corps,
      url: url || `/messages`,
      conversationId: conversation_id,
      tag: `conv-${conversation_id}`,
    })

    const results = await Promise.allSettled(
      subscriptions.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    )

    // Nettoyer les souscriptions expirées (410 Gone / 404)
    const expired = results
      .map((r, i) => ({ r, sub: subscriptions[i] }))
      .filter(
        ({ r }) =>
          r.status === 'rejected' &&
          ((r as PromiseRejectedResult).reason?.statusCode === 410 ||
            (r as PromiseRejectedResult).reason?.statusCode === 404)
      )

    if (expired.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expired.map(({ sub }) => sub.endpoint))
    }

    const sent = results.filter((r) => r.status === 'fulfilled').length

    return new Response(
      JSON.stringify({ ok: true, sent, total: subscriptions.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('[PUSH] Exception:', e)
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
