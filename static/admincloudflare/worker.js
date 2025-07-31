// Cloudflare Worker proxy pour Decap CMS + Supabase Auth
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Gérer les requêtes CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCors();
    }

    // 2. Endpoint pour vérifier l'auth Supabase
    if (url.pathname === '/auth/verify') {
      return handleSupabaseAuth(request, env);
    }

    // 3. Proxy vers GitHub API (avec token fixe)
    return handleGitHubProxy(request, env);
  },
};

// Vérification de l'authentification Supabase
async function handleSupabaseAuth(request, env) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return corsResponse(new Response('No token provided', { status: 401 }));
    }

    // Vérifier le token Supabase
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return corsResponse(new Response('Supabase config missing', { status: 500 }));
    }

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseKey,
      },
    });

    if (!userResponse.ok) {
      return corsResponse(new Response('Invalid token', { status: 401 }));
    }

    const userData = await userResponse.json();

    // Retourner les infos utilisateur pour Decap
    return corsResponse(new Response(JSON.stringify({
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.user_metadata?.full_name || userData.email,
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    }));

  } catch (error) {
    return corsResponse(new Response('Auth verification failed', { status: 500 }));
  }
}

// Proxy vers GitHub API avec token fixe
async function handleGitHubProxy(request, env) {
  const url = new URL(request.url);

  // Construire l'URL GitHub API
  let apiPath = url.pathname;

  // Nettoyer le chemin si nécessaire
  if (apiPath.startsWith('/api/v1')) {
    apiPath = apiPath.replace('/api/v1', '');
  }

  const githubUrl = `https://api.github.com${apiPath}${url.search}`;

  // Utiliser le token GitHub fixe configuré dans les variables d'environnement
  const githubToken = env.GITHUB_TOKEN;

  if (!githubToken) {
    return corsResponse(
      new Response('GitHub token not configured', { status: 500 })
    );
  }

  // Créer la requête vers GitHub
  const githubRequest = new Request(githubUrl, {
    method: request.method,
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': request.headers.get('Content-Type') || 'application/json',
      'User-Agent': 'decap-cms-supabase-proxy/1.0',
    },
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });

  try {
    const response = await fetch(githubRequest);

    // Log pour debug
    console.log(`GitHub API ${request.method} ${githubUrl} -> ${response.status}`);

    const proxyResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    return corsResponse(proxyResponse);

  } catch (error) {
    console.error('GitHub API Error:', error);
    return corsResponse(
      new Response(`Proxy error: ${error.message}`, { status: 500 })
    );
  }
}

// Ajouter les en-têtes CORS à une réponse
function corsResponse(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

// Gérer les requêtes CORS preflight
function handleCors() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    },
  });
}
