/**
 * Configuration des routes pour sv-router
 *
 * Ce fichier définit toutes les routes de l'application avec :
 * - Les routes publiques (sans authentification)
 * - Les routes privées (protégées par eventGuard ou authGuard)
 * - Les routes events (mode agnostic : démo ou normal)
 *
 * Structure des routes :
 * - Les routes avec paramètres dynamiques utilisent la syntaxe :param
 * - Les routes protégées utilisent hooks: { beforeLoad }
 * - Les composants sont chargés en lazy loading avec import()
 *
 * Documentation sv-router :
 * - Routes: https://sv-router.vercel.app/guide/code-based/dynamic-routes
 * - Hooks: https://sv-router.vercel.app/guide/code-based/hooks
 */

import type { Routes } from "sv-router";
import { authGuard, eventGuard } from "./guards";

/**
 * Toutes les routes de l'application
 *
 * Organisation :
 * 1. Routes publiques (/)
 * 2. Routes recettes (/recipe/*)
 * 3. Routes dashboard privées (/dashboard/*)
 * 4. Routes events unifiées (/event/* - mode agnostic)
 * 5. Routes documents (/createdocument/*, /editdocument/*, /documents/*)
 * 6. Routes events (/eventList)
 * 7. Route 404 catch-all
 */
export const routes: Routes = {
  // ============================================
  // ROUTES PUBLIQUES (sans authentification)
  // ============================================

  "/": () => import("$lib/routes/HomePage.svelte"),

  "/verify-email": () => import("$lib/routes/VerifyEmailPage.svelte"),

  // Routes de listing des recettes (publiques et privées)
  "/recipe": () => import("$lib/routes/RecipesListPage.svelte"),

  // Détail d'une recette (publique)
  "/recipe/:uuid": () => import("$lib/routes/RecipeDetailPage.svelte"),

  // Acceptation d'invitation
  "/accept-invite": () => import("$lib/routes/AcceptInvite.svelte"),

  // Reset password
  "/reset-password": () => import("$lib/routes/ResetPassword.svelte"),

  // ============================================
  // ROUTES PRIVÉES (protégées par authGuard)
  // ============================================

  // Dashboard
  "/dashboard": {
    hooks: authGuard,
    "/": () => import("$lib/routes/DashboardPage.svelte"),
    "/user": () => import("$lib/routes/UserPage.svelte"),
    "/teams": () => import("$lib/routes/TeamsManagement.svelte"),
    "/eventCreate": () => import("$lib/routes/EventCreatePage.svelte"),
    "/eventCreate/:teamId": () => import("$lib/routes/EventCreatePage.svelte"),
    "/materiel": () => import("$lib/routes/MaterielPage.svelte"),
    "/materiel/:teamId": () => import("$lib/routes/MaterielPage.svelte"),
    "/loans": () => import("$lib/routes/LoansPage.svelte"),
    "/loans/:teamId": () => import("$lib/routes/LoansPage.svelte"),
    "/loans/return/:loanId": () => import("$lib/routes/LoanReturnPage.svelte"),
  },

  // Recettes privées
  "/recipe/my": {
    hooks: authGuard,
    "/": () => import("$lib/routes/RecipesListPage.svelte"),
    "/draft": () => import("$lib/routes/RecipesListPage.svelte"),
  },

  // Création/édition de recettes
  "/recipe/new": {
    hooks: authGuard,
    "/": () => import("$lib/routes/RecipeCreatePage.svelte"),
  },

  "/recipe/:uuid/edit": (() => {
    const component = () => import("$lib/routes/RecipeEditPage.svelte");
    (component as any).hooks = authGuard;
    return component;
  })(),

  "/recipe/:uuid/duplicate": (() => {
    const component = () => import("$lib/routes/RecipeCreatePage.svelte");
    (component as any).hooks = authGuard;
    return component;
  })(),

  // Liste des événements
  "/eventList": {
    hooks: authGuard,
    "/": () => import("$lib/routes/EventListPage.svelte"),
  },

  // Gestion des documents
  "/createdocument/:teamId/new": (() => {
    const component = () => import("$lib/routes/CreateDocumentPage.svelte");
    (component as any).hooks = authGuard;
    return component;
  })(),

  "/editdocument/:teamId/:docId": (() => {
    const component = () => import("$lib/routes/EditDocumentPage.svelte");
    (component as any).hooks = authGuard;
    return component;
  })(),

  "/documents/:teamId": (() => {
    const component = () => import("$lib/routes/DocumentListPage.svelte");
    (component as any).hooks = authGuard;
    return component;
  })(),

  // ============================================
  // ROUTES EVENTS UNIFIÉES (mode agnostic)
  // ============================================
  // Ces routes fonctionnent aussi bien pour les events démo que pour les events normaux
  // Le guard intelligent détecte le mode via l'ID de l'event

  "/event/:id": {
    hooks: eventGuard,
    "/": () => import("$lib/routes/EventEditPage.svelte"),
    "/recipes": () => import("$lib/routes/EventRecipesPage.svelte"),
    "/products": () => import("$lib/routes/EventProductsPage.svelte"),
    "/posters": () => import("$lib/routes/EventPosterPage.svelte"),
  },

  // ============================================
  // ROUTE 404 CATCH-ALL
  // ============================================

  // DOIT être en dernier - attrape toutes les routes non définies
  "(*)": () => import("$lib/routes/NotFoundPage.svelte"),
};
