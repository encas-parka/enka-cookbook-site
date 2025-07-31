// cloudflare-workers : is updload and deploy on cloudflare

export default {
  async fetch(request, env) {
    // 1. Gérer immédiatement les requêtes CORS "preflight"
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    // 2. Construire l'URL cible de l'API GitHub
    const url = new URL(request.url);
    // On retire le début du chemin pour ne garder que la partie API
    // Exemple : /repos/user/repo/contents/...
    const targetPath = url.pathname;
    const targetUrl = `https://api.github.com${targetPath}${url.search}`;

    // 3. Récupérer le jeton GitHub depuis les secrets
    const githubPat = env.GITHUB_PAT;
    if (!githubPat) {
      return new Response('Configuration Error: GITHUB_PAT secret is not set.', { status: 500 });
    }

    // 4. Créer la requête pour GitHub en ajoutant le jeton
    const githubRequest = new Request(targetUrl, {
      method: request.method,
      headers: {
        ...request.headers, // On copie les en-têtes de Decap (Accept, Content-Type, etc.)
        'Authorization': `Bearer ${githubPat}`, // On ajoute/remplace l'authentification
        'User-Agent': 'decap-cms-cloudflare-proxy', // Bonne pratique
      },
      body: request.body,
    });

    // 5. Envoyer la requête à GitHub et attendre la réponse
    const responseFromGithub = await fetch(githubRequest);

    // 6. Renvoyer la réponse de GitHub à Decap CMS, en ajoutant nos en-têtes CORS
    const response = new Response(responseFromGithub.body, responseFromGithub);
    response.headers.set('Access-Control-Allow-Origin', '*'); // Ou l'URL de votre site pour plus de sécurité
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;
  },
};

// Fonction utilitaire pour répondre aux requêtes OPTIONS
function handleOptions(request) {
  if (
    request.headers.get('Origin') !== null &&
    request.headers.get('Access-Control-Request-Method') !== null &&
    request.headers.get('Access-Control-Request-Headers') !== null
  ) {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*', // Ou l'URL de votre site
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
  return new Response(null, { headers: { 'Allow': 'GET, POST, PUT, DELETE, OPTIONS' } });
}
