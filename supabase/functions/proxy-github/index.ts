import { createClient } from 'supabase'

// Fonction principale qui gère toutes les requêtes
Deno.serve(async (req) => {
  // Gérer la requête CORS "preflight" que le navigateur envoie en premier
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders() })
  }

  try {
    // 1. VÉRIFICATION DE L'AUTHENTIFICATION (la magie de l'intégration)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error } = await supabaseClient.auth.getUser()

    if (error || !user) {
      console.error("Auth Error:", error?.message);
      return new Response("Accès non autorisé. L'utilisateur n'est pas connecté.", { status: 401, headers: getCorsHeaders() })
    }

    console.log(`[Proxy] Requête de ${user.email} reçue.`);

    // 2. RELAIS SÉCURISÉ VERS GITHUB
    const githubPat = Deno.env.get('GITHUB_PAT')
    if (!githubPat) {
      console.error("FATAL: Le secret GITHUB_PAT n'est pas défini dans Supabase.");
      return new Response("Erreur de configuration du serveur proxy.", { status: 500, headers: getCorsHeaders() });
    }

    // Reconstruit l'URL cible de l'API GitHub
    const url = new URL(req.url)
    const targetPath = url.pathname.replace(/^\/functions\/v1\/proxy-github/, '')
    const targetUrl = `https://api.github.com${targetPath}${url.search}`

    // Crée une nouvelle requête pour GitHub
    const githubReq = new Request(targetUrl, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${githubPat}`,
        'Content-Type': req.headers.get('Content-Type') || 'application/json',
        'Accept': req.headers.get('Accept') || 'application/vnd.github.v3+json',
      },
      body: req.body,
    });

    // Envoie la requête à GitHub
    const githubRes = await fetch(githubReq);

    // 3. RETOUR DE LA RÉPONSE À DECAP CMS
    // Il faut recréer une réponse pour pouvoir y ajouter nos en-têtes CORS
    const response = new Response(githubRes.body, {
      status: githubRes.status,
      headers: { ...getCorsHeaders(), 'Content-Type': githubRes.headers.get('Content-Type')! },
    })

    return response

  } catch (err) {
    console.error("[Proxy] Erreur inattendue:", err);
    return new Response(JSON.stringify({ message: "Erreur interne du proxy.", details: err.message }), { status: 500, headers: getCorsHeaders() });
  }
})

// Fonction utilitaire pour centraliser les en-têtes CORS
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*', // Pour le développement. En production, remplacez par l'URL de votre site : 'https://mon-site.pages.dev'
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }
}
