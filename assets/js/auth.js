// Fichier : assets/js/auth.js

// Importe la fonction createClient depuis le CDN de Supabase.
// C'est la méthode la plus simple pour un site statique comme Hugo.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// --- CONFIGURATION ---
const SUPABASE_URL = "https://mkkrfozercivwnbmqfqe.supabase.co/";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ra3Jmb3plcmNpdnduYm1xZnFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5MTQ5MDIsImV4cCI6MjA2OTQ5MDkwMn0.E4uPMUe4JYR75IcCO8LkwC_ngoQkZwKowcLJP3lDqTQ";

// --------------------

// Crée le client Supabase une seule fois
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Récupère les éléments du DOM avec lesquels nous allons interagir
const loggedInState = document.getElementById("user-logged-in");
const loggedOutState = document.getElementById("user-logged-out");
const loginForm = document.getElementById("login-form");
const logoutButton = document.getElementById("logout-button");
const errorMessage = document.getElementById("error-message");
const loginButton = document.getElementById("login-button");
const loginSpinner = loginButton.querySelector(".spinner-border");
const userEmailDisplay = document.getElementById("user-email-display");

/**
 * Fonction pour configurer l'authentification du CMS et rediriger.
 */
async function setupCmsAuthenticationAndRedirect() {
  try {
    // Appelle la fonction Supabase 'get-cms-auth'
    const { data: cmsAuth, error: functionError } = await supabase.functions.invoke('get-cms-auth');

    if (functionError) {
      // Si la fonction elle-même retourne une erreur (ex: l'utilisateur n'est pas authentifié)
      throw functionError;
    }

    localStorage.setItem('sveltia-cms.user', JSON.stringify(cmsAuth));


    window.location.href = "/adminsupa/";

  } catch (e) {
    console.error("Erreur lors de la configuration de l'authentification CMS :", e);
    errorMessage.textContent = "Impossible de configurer la connexion au CMS. Erreur : " + e.message;
    errorMessage.style.display = "block";
  }
}


/**
 * Gère la soumission du formulaire de connexion
 */
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault(); // Empêche le rechargement de la page

  // Affiche le spinner et désactive le bouton
  loginSpinner.style.display = "inline-block";
  loginButton.disabled = true;
  errorMessage.style.display = "none";

  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  // Tente de connecter l'utilisateur avec Supabase
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) {
    // En cas d'erreur de connexion, l'afficher
    errorMessage.textContent = "L'email ou le mot de passe est incorrect.";
    errorMessage.style.display = "block";
  } else if (data.session) {
    // --- MODIFIÉ ---
    // Si la connexion réussit, au lieu de rediriger directement,
    // on appelle notre nouvelle fonction qui s'occupe de tout.
    await setupCmsAuthenticationAndRedirect();
  }

  // Cache le spinner et réactive le bouton (sauf en cas de redirection réussie)
  loginSpinner.style.display = "none";
  loginButton.disabled = false;
});

/**
 * Gère la déconnexion
 */
logoutButton.addEventListener("click", async () => {
  // --- AJOUTÉ ---
  // Bonne pratique : vider le local storage à la déconnexion
  localStorage.removeItem('sveltia-cms.user');

  await supabase.auth.signOut();
  // Recharger la page pour mettre à jour l'état (la fonction onAuthStateChange s'en occupera)
  location.reload();
});

/**
 * Vérifie l'état de connexion au chargement de la page et à chaque changement
 * --- INCHANGÉ --- (Ce code est parfait tel quel)
 */
supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    // L'utilisateur est connecté
    loggedInState.style.display = "block";
    loggedOutState.style.display = "none";
    // Affiche l'email de l'utilisateur pour personnaliser l'accueil
    if (session.user && session.user.email) {
      userEmailDisplay.textContent = ` (${session.user.email})`;
    }
  } else {
    // L'utilisateur n'est pas connecté
    loggedInState.style.display = "none";
    loggedOutState.style.display = "block";
  }
});
