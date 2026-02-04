<script lang="ts">
  import { navigate } from "$lib/router";
  import { globalState } from "../stores/GlobalState.svelte";
  import { ChefHat, ArrowRight, ArrowDown, Eye } from "@lucide/svelte";
  import { eventsStore } from "../stores/EventsStore.svelte";
  import { toastService } from "../services/toast.service.svelte";
  import { fade, fly } from "svelte/transition";
  import { cubicInOut } from "svelte/easing";
  import { scrollY } from "svelte/reactivity/window";
  import { DEMO_EVENT_ID } from "$lib/data/demo-event-config";
  import LoadingSpinner from "../components/ui/LoadingSpinner.svelte";
  import EmailVerificationAlert from "../components/ui/EmailVerificationAlert.svelte";

  function openAuthModal() {
    globalState.authModal.isOpen = true;
  }

  function openRegisterModal() {
    globalState.authModal.showLogin = false;
    globalState.authModal.isOpen = true;
  }

  export function fadeScale(
    node,
    { duration = 300, delay = 0, start = 0.8 } = {},
  ) {
    return {
      delay,
      duration,
      easing: cubicInOut,
      css: (t) => `
        opacity: ${t};
        transform: scale(${start + (1 - start) * t});
      `,
    };
  }

  let isDemoLoading = $state(false);

  async function handleDemoEvent() {
    try {
      const toastId = toastService.loading("Chargement de la démo...");
      isDemoLoading = true;

      // Le guard eventGuard s'occupe de l'initialisation du store
      toastService.dismiss(toastId);
      navigate(`/event/${DEMO_EVENT_ID}`);
    } catch (error) {
      console.error("[HomePage] Erreur chargement démo:", error);
      toastService.error("Erreur lors du chargement de la démo");
    } finally {
      isDemoLoading = false;
    }
  }

  const features = [
    {
      id: "feature-1",
      title: "Organisation",
      description:
        "Élaborez des menus sur plusieurs jours et organisez-vous en équipes",
      screenshot: "/images/home/events.webp",
      buttonText: "Voir la démo",
      buttonAction: handleDemoEvent,
      theme: "secondary" as const,
    },
    {
      id: "feature-2",
      title: "Listes de courses",
      description: "Générez automatiquement les listes de courses de vos menus",
      items: [
        "Suivez l'avancement des achats",
        "Notez les dépenses",
        "Répartissez vous les courses",
      ],
      screenshot: "/images/home/product.webp",
      theme: "secondary" as const,
    },
    {
      id: "feature-3",
      title: "Gérez le matos collectifs",
      description: "Maintenez un inventaires, gérer les emprunts",
      screenshot: "/images/home/matos.webp",
      theme: "secondary" as const,
    },
    {
      id: "feature-4",
      title: "Imprimez facilement les recettes",
      description:
        "L'impression des recettes est optimisé pour un rendu noir et blanc, sans l'interface web",
      screenshot: "/images/home/recipe-print.webp",
      theme: "primary" as const,
    },
  ];

  // ScrollState : gestion réactive du scroll
  let featuresContainer: HTMLElement | undefined = $state(undefined);
  let activeIndex = $state(0);
  let continuousProgress = $state(0); // Progression continue 0-4

  // Initialiser le smart header de GlobalState
  globalState.initializeScrollDirection();

  // Direction du scroll depuis GlobalState
  const isScrollingDown = $derived(globalState.scrollDirection === "down");

  // Handler pour le scroll avec scrollY natif
  function handleScroll() {
    if (!featuresContainer) return;

    // Calculer la position relative au container features
    const rect = featuresContainer.getBoundingClientRect();
    const containerHeight = featuresContainer.scrollHeight;
    const windowHeight = window.innerHeight;

    // Scroll relatif au container (négatif quand on descend dans la section)
    const scrolled = -rect.top;
    const totalScrollable = containerHeight - windowHeight;

    // Progression 0 à features.length
    const rawProgress = Math.max(
      0,
      Math.min(features.length, (scrolled / totalScrollable) * features.length),
    );

    // Mise à jour de l'index actif (pour le snap du texte)
    const newActiveIndex = Math.min(
      features.length - 1,
      Math.max(0, Math.floor(rawProgress + 0.3)),
    );

    if (newActiveIndex !== activeIndex) {
      activeIndex = newActiveIndex;
    }

    // Mise à jour de la progression continue
    continuousProgress = rawProgress;
  }

  // $effect pour réagir aux changements de scrollY
  $effect(() => {
    // Juste déclencher handleScroll quand scrollY change
    scrollY.current;
    handleScroll();
  });

  const themeBtnClasses = (theme: "primary" | "secondary" = "primary") => {
    return theme === "primary" ? "btn-primary" : "btn-secondary";
  };

  /**
   * État d'animation pour le TEXTE avec snap et plateau
   * Utilise un plateau de 30% (0.35 → 0.65) pour le moment de lisibilité
   */
  function getSnapState(index: number) {
    const isActive = index === activeIndex;
    const isPrev = index < activeIndex;
    const isNext = index > activeIndex;

    // Animation directionnelle : translateY inversé selon direction du scroll
    let translateY: number;
    if (isScrollingDown) {
      // Scroll ↓ : le texte vient d'en bas
      translateY = isPrev ? -20 : isNext ? 20 : 0;
    } else {
      // Scroll ↑ : le texte vient d'en haut
      translateY = isPrev ? 20 : isNext ? -20 : 0;
    }

    return {
      opacity: isActive ? 1 : 0,
      translateX: 0, // Pas de translateX, on garde seulement Y
      translateY,
      scale: isActive ? 1 : 0.88,
      zIndex: isActive ? 10 : 0,
      pointerEvents: isActive ? "auto" : "none",
    };
  }

  // Nouveaux délais progressifs pour les éléments
  function getElementDelay(elementIndex: number, isActive: boolean) {
    if (!isActive) return 0;
    return elementIndex * 150; // 80ms entre chaque élément
  }
</script>

<div class="bg-base-200">
  <!-- Alerte de vérification d'email -->

  <!-- SECTION 1: Hero -->
  <section
    class="hero bg-base-200 flex flex-col justify-center gap-20 md:min-w-full md:py-15"
  >
    <div class="hero-content text-center">
      <div class="max-w-3xl">
        <div class="mb-4 flex justify-center" in:fadeScale={{ duration: 800 }}>
          <img
            src="/images/logo.svg"
            alt="Enka Cookbook"
            class="size-40 md:size-80"
          />
        </div>
        <h1
          class="cherry-bomb-one-regular text-4xl md:text-7xl"
          in:fly={{ y: 30, duration: 600, delay: 100 }}
        >
          {#each "Enka Cookbook" as l}
            <span class="hover:text-primary transition-colors duration-200"
              >{l}</span
            >
          {/each}
        </h1>
        <div
          class="text-base-content/70 mt-6 space-x-1 text-base md:text-xl"
          in:fly={{ y: 20, duration: 800, delay: 200 }}
        >
          {#each ["Outils", " de", " planification", " pour", " les", " cantines", " autogérées"] as w, i (i)}
            <div
              class=" hover:text-primary inline-block transition-all duration-75 hover:rotate-3"
            >
              {w}
            </div>
          {/each}
        </div>
      </div>
    </div>
    <div
      class="flex flex-wrap items-center justify-center gap-6"
      in:fadeScale={{ duration: 400, delay: 400, start: 0.9 }}
    >
      <button
        class="btn btn-primary md:btn-lg transition-all duration-300 hover:scale-110"
        onclick={() => navigate("/recipe")}
        in:fadeScale={{ duration: 400, delay: 450, start: 0.9 }}
      >
        <ChefHat size={24} />
        <span class="flex items-baseline gap-2"> Voir les recettes </span>
      </button>

      {#if globalState.isAuthenticated}
        <button
          class="btn btn-outline btn-secondary md:btn-lg transition-all duration-300 hover:scale-110"
          onclick={() => navigate("/dashboard")}
          in:fadeScale={{ duration: 400, delay: 500, start: 0.9 }}
        >
          <ArrowRight size={24} />
          Accéder au tableau de bord
        </button>
      {:else}
        <button
          class="btn btn-secondary md:btn-lg transition-all duration-300 hover:scale-110"
          onclick={openRegisterModal}
        >
          Créer un compte pour commencer
          <ArrowRight size={24} />
        </button>
      {/if}
    </div>

    {#if !globalState.isAuthenticated}
      <p class="text-base-content/60 text-center">
        Déjà membre ? <button class="link" onclick={openAuthModal}>
          Connectez-vous
        </button> pour gérer vos cantines et équipes
      </p>
    {/if}
    <EmailVerificationAlert />

    <div
      class="text-base-content/40 flex flex-col items-center justify-center gap-2"
    >
      <div>En savoir plus</div>
      <button class="btn btn-circle btn-ghost mt-auto animate-bounce">
        <ArrowDown class=" size-8" />
      </button>
    </div>
  </section>

  <!-- SECTION 2: Features avec snapping et transitions séquentielles -->
  <section class=" relative" bind:this={featuresContainer}>
    <!-- Contenu fixe visible -->
    <div
      class="to-neutral/20 from-base-100 sticky top-10 flex min-h-screen flex-col items-center justify-center bg-linear-to-l px-4 pb-10"
    >
      <!-- <button
        class="btn btn-lg btn-accent mb-10 w-fit"
        onclick={handleDemoEvent}
      >
        {#if isDemoLoading}
          <span class="loading loading-spinner"> </span>
        {:else}
          <Eye size={24} />
        {/if}
        Voir la démo d'événement
      </button> -->
      <div
        class="grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-5 lg:gap-16"
      >
        <!-- Screenshot avec cross-fade clean et défilement vertical fluide -->
        <div
          class="bg-base-300 relative col-span-3 hidden aspect-video overflow-hidden rounded-4xl shadow-2xl lg:block"
        >
          {#each features as feature, i}
            {@const state = getSnapState(i)}
            {@const scrollY = (continuousProgress - i) * 50}
            <div
              class="absolute inset-0 bg-cover bg-center transition-opacity duration-700 ease-out"
              style="opacity: {state.opacity}; z-index: {state.zIndex}; background-image: url('{feature.screenshot}'); background-position-y: calc({scrollY *
                -10}px);"
            ></div>
          {/each}
        </div>

        <!-- Contenu texte avec transitions séquentielles -->
        <div class="relative col-span-2 min-h-112.5">
          <!-- Icône animée unique (feedback visuel continu) -->
          <div
            class="absolute -right-2 bottom-2 flex -translate-y-1/2 items-center justify-center"
            style="transform: rotate({continuousProgress *
              180}deg); transition: none;"
          >
            <img src="/images/logo.svg" alt="EC" class="size-16" />
          </div>

          <!-- Contenu texte (avec snap + plateau) -->
          {#each features as feature, i}
            {@const state = getSnapState(i)}
            {@const isActive = i === activeIndex}
            <div
              class="absolute inset-0"
              style="
                  opacity: {state.opacity};
                  transform: translateX({state.translateX}px) translateY({state.translateY}px) scale({state.scale});
                  z-index: {state.zIndex};
                  pointer-events: {state.pointerEvents};
                  transition: opacity 600ms ease-out, transform 600ms ease-out;
                "
            >
              <div class="space-y-6">
                <!-- Titre avec délai 0 -->
                <h3
                  class="text-base-content mt-10 text-3xl font-bold md:text-4xl"
                  style="
                      opacity: {isActive ? 1 : 0};
                      transform:  translateX({isActive ? 0 : 55}px);
                      transition: opacity 500ms ease-out {getElementDelay(
                    0,
                    isActive,
                  )}ms,
                                  transform 500ms ease-out {getElementDelay(
                    0,
                    isActive,
                  )}ms;
                    "
                >
                  {feature.title}
                </h3>

                <!-- Description avec délai 1 -->
                <p
                  class="text-base-content/70 text-lg leading-relaxed"
                  style="
                      opacity: {isActive ? 1 : 0};
                      transform: translateX({isActive ? 0 : 35}px);
                      transition: opacity 500ms ease-out {getElementDelay(
                    1,
                    isActive,
                  )}ms,
                                  transform 500ms ease-out {getElementDelay(
                    1,
                    isActive,
                  )}ms;
                    "
                >
                  {feature.description}
                </p>

                {#if feature.items}
                  <!-- Liste avec délai 2 -->
                  <ul
                    class="mt-8 space-y-3"
                    style="
                        opacity: {isActive ? 1 : 0};
                        transform: translateY({isActive ? 0 : 15}px);
                        transition: opacity 500ms ease-out {getElementDelay(
                      2,
                      isActive,
                    )}ms,
                                    transform 500ms ease-out {getElementDelay(
                      2,
                      isActive,
                    )}ms;
                      "
                  >
                    {#each feature.items as item, itemIdx}
                      <li
                        class="text-base-content flex items-start gap-3"
                        style="
                            opacity: {isActive ? 1 : 0};
                            transform: translateX({isActive ? 0 : -10}px);
                            transition: opacity 400ms ease-out {getElementDelay(
                          3,
                          isActive,
                        ) +
                          itemIdx * 50}ms,
                                        transform 400ms ease-out {getElementDelay(
                          3,
                          isActive,
                        ) +
                          itemIdx * 50}ms;
                          "
                      >
                        <svg
                          class="text-primary mt-0.5 h-6 w-6 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span>{item}</span>
                      </li>
                    {/each}
                  </ul>
                {/if}

                {#if feature.buttonText && feature.buttonAction}
                  <!-- Bouton avec dernier délai -->
                  <div
                    class="mt-8"
                    style="
                        opacity: {isActive ? 1 : 0};
                        transform: translateY({isActive
                      ? 0
                      : 15}px) scale({isActive ? 1 : 0.95});
                        transition: opacity 500ms ease-out {getElementDelay(
                      feature.items ? 4 : 3,
                      isActive,
                    )}ms,
                                    transform 500ms ease-out {getElementDelay(
                      feature.items ? 4 : 3,
                      isActive,
                    )}ms;
                      "
                  ></div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Indicateur de progression avec double layer -->
      <div class="absolute right-0 bottom-15 left-0 flex justify-center px-4">
        <div
          class="bg-base-100/80 flex max-w-full gap-2 overflow-x-auto rounded-full px-4 py-3 shadow-lg backdrop-blur-sm md:gap-3 md:px-6 md:py-4"
        >
          {#each features as _, idx}
            <div
              class="bg-base-300 relative h-2 w-12 shrink-0 overflow-hidden rounded-full md:w-16"
            >
              <!-- Barre de progression continue (transparente) -->
              <div
                class="bg-primary/30 absolute inset-y-0 left-0 rounded-full transition-all duration-200 ease-out"
                style="width: {Math.max(
                  0,
                  Math.min(1, continuousProgress - idx),
                ) * 100}%"
              ></div>
              <!-- Barre d'état actif (opaque) -->
              <div
                class="bg-primary absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
                style="width: {activeIndex === idx ? 100 : 0}%"
              ></div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Hauteur de scroll invisible (sans snap CSS) -->
    <div class="relative -z-10">
      {#each features as feature}
        <div class="h-screen"></div>
      {/each}
    </div>
  </section>
</div>

<style>
  .cherry-bomb-one-regular {
    font-family: "Cherry Bomb One", system-ui;
    font-weight: 400;
    font-style: normal;
  }

  :global(html) {
    scroll-behavior: smooth;
  }
</style>
