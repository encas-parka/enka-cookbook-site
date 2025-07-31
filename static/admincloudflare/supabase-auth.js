import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Configuration Supabase
const SUPABASE_URL = "https://mkkrfozercivwnbmqfqe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ra3Jmb3plcmNpdnduYm1xZnFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5MTQ5MDIsImV4cCI6MjA2OTQ5MDkwMn0.E4uPMUe4JYR75IcCO8LkwC_ngoQkZwKowcLJP3lDqTQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Créer un backend personnalisé pour Decap CMS
class SupabaseBackend {
  constructor(config, options) {
    this.config = config;
    this.options = options;
    this.proxyUrl = config.proxy_url || config.base_url;
  }

  async authenticate() {
    // Vérifier si l'utilisateur est déjà connecté avec Supabase
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      // Rediriger vers la page de login
      window.location.href = '/login/';
      throw new Error('Not authenticated');
    }

    // Vérifier le token avec notre proxy
    try {
      const response = await fetch(`${this.proxyUrl}/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: session.access_token
        })
      });

      if (!response.ok) {
        throw new Error('Token verification failed');
      }

      const userData = await response.json();
      return {
        name: userData.user.name,
        email: userData.user.email,
        avatar_url: userData.user.avatar_url,
        token: session.access_token
      };
    } catch (error) {
      console.error('Authentication error:', error);
      window.location.href = '/login/';
      throw error;
    }
  }

  async logout() {
    await supabase.auth.signOut();
    window.location.href = '/login/';
  }

  // Proxy toutes les autres méthodes vers l'API GitHub via notre worker
  async request(path, options = {}) {
    const url = `${this.proxyUrl}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }

    return response;
  }

  // Implémentation des méthodes requises par Decap CMS
  async getEntry(path) {
    const response = await this.request(`/repos/${this.config.repo}/contents/${path}`, {
      method: 'GET'
    });
    return response.json();
  }

  async persistEntry(entry) {
    const path = `content/${entry.collection}/${entry.slug}.md`;
    const content = this.serializeEntry(entry);

    const response = await this.request(`/repos/${this.config.repo}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Create/Update ${entry.title}`,
        content: btoa(unescape(encodeURIComponent(content))),
        branch: this.config.branch
      })
    });

    return response.json();
  }

  async deleteEntry(path) {
    // Récupérer le SHA du fichier d'abord
    const fileResponse = await this.request(`/repos/${this.config.repo}/contents/${path}`);
    const fileData = await fileResponse.json();

    const response = await this.request(`/repos/${this.config.repo}/contents/${path}`, {
      method: 'DELETE',
      body: JSON.stringify({
        message: `Delete ${path}`,
        sha: fileData.sha,
        branch: this.config.branch
      })
    });

    return response.json();
  }

  serializeEntry(entry) {
    const frontMatter = Object.keys(entry.data)
      .map(key => `${key}: ${JSON.stringify(entry.data[key])}`)
      .join('\n');

    return `---\n${frontMatter}\n---\n\n${entry.content || ''}`;
  }
}

// Enregistrer le backend personnalisé
if (window.CMS) {
  window.CMS.registerBackend('supabase-proxy', SupabaseBackend);
}
