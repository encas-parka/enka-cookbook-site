import { createClient } from 'supabase'

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*', // Ou votre domaine de production
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }
}

Deno.serve(async (req) => {
  // Gérer la requête CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders() })
  }

  try {
    // 1. VÉRIFIER LA PRÉSENCE DE L'EN-TÊTE D'AUTHENTIFICATION
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("[Proxy Auth] Erreur: En-tête 'Authorization' manquant.");
      return new Response("En-tête d'authentification manquant.", { status: 401, headers: getCorsHeaders() });
    }
    console.log("[Proxy Auth] En-tête 'Authorization' trouvé.");

    // 2. VALIDER L'UTILISATEUR AUPRÈS DE SUPABASE
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error("[Proxy Auth] Erreur de validation de l'utilisateur:", userError?.message);
      return new Response("Jeton d'authentification invalide ou expiré.", { status: 401, headers: getCorsHeaders() });
    }
    console.log(`[Proxy Auth] Utilisateur validé: ${user.email}`);

    // 3. RELAYER LA REQUÊTE VERS GITHUB
    const githubPat = Deno.env.get('GITHUB_PAT');
    if (!githubPat) {
      console.error("[Proxy GitHub] FATAL: Le secret GITHUB_PAT n'est pas défini.");
      return new Response("Erreur de configuration du serveur proxy.", { status: 500, headers: getCorsHeaders() });
    }
    console.log(`[Proxy GitHub] Relais de la requête pour ${user.email} vers l'API GitHub.`);

    const url = new URL(req.url);
    const targetPath = url.pathname.replace(/^\/functions\/v1\/proxy-github/, '');
    const targetUrl = `https://api.github.com${targetPath}${url.search}`;

    const githubReq = new Request(targetUrl, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${githubPat}`,
        'Content-Type': req.headers.get('Content-Type') || 'application/json',
        'Accept': req.headers.get('Accept') || 'application/vnd.github.v3+json',
      },
      body: req.body,
    });

    const githubRes = await fetch(githubReq);
    console.log(`[Proxy GitHub] Réponse de GitHub reçue avec le statut: ${githubRes.status}`);

    // 4. RETOURNER LA RÉPONSE DE GITHUB À DECAP CMS
    // Important: Il faut recréer les en-têtes pour inclure nos propres en-têtes CORS
    const responseHeaders = new Headers(githubRes.headers);
    Object.entries(getCorsHeaders()).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    return new Response(githubRes.body, {
      status: githubRes.status,
      headers: responseHeaders,
    });

  } catch (err) {
    console.error("[Proxy] Erreur globale inattendue:", err);
    return new Response(JSON.stringify({ message: "Erreur interne du proxy.", details: err.message }), { status: 502, headers: getCorsHeaders() });
  }
});
