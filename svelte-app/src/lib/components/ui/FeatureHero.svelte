<script lang="ts">
  import { useIntersectionObserver } from "runed";
  import type { Snippet } from "svelte";
  import { fade } from "svelte/transition";

  interface Props {
    image?: string | string[]; // Image unique ou tableau d'images pour carrousel
    title: string; // Titre de la feature
    description?: string; // Description HTML
    buttonText?: string; // Texte du bouton
    buttonAction?: () => void; // Action du bouton
    theme?: "primary" | "secondary";
    extra?: Snippet; // Contenu additionnel
    children?: Snippet; // Contenu HTML supplémentaire (children)
    autoScrollInterval?: number; // Intervalle de défilement auto en ms (false pour désactiver)
  }

  let {
    image,
    title,
    description,
    buttonText,
    buttonAction,
    theme = "primary",
    extra,
    children,
    autoScrollInterval = 3000,
  }: Props = $props();

  // Normaliser les images en tableau
  const images = $derived.by(() => {
    if (!image) return [];
    return Array.isArray(image) ? image : [image];
  });

  // État du carrousel
  let currentIndex = $state(0);

  // Fonctions de navigation
  function nextImage() {
    if (images.length > 0) {
      currentIndex = (currentIndex + 1) % images.length;
    }
  }

  function prevImage() {
    if (images.length > 0) {
      currentIndex = (currentIndex - 1 + images.length) % images.length;
    }
  }

  function goToImage(index: number) {
    currentIndex = index;
  }

  // Défilement automatique avec $effect
  $effect(() => {
    // Ne pas activer si moins de 2 images ou intervalle désactivé
    if (images.length < 2 || !autoScrollInterval || autoScrollInterval <= 0) {
      return;
    }

    const interval = setInterval(() => {
      nextImage();
    }, autoScrollInterval);

    // Cleanup : arrêter l'intervalle lors de la destruction ou re-run
    return () => clearInterval(interval);
  });

  const themeClasses = {
    primary: "text-primary",
    secondary: "text-secondary",
  };

  // États pour les animations staggered (multi-observers)
  let sectionRef = $state<HTMLElement | null>(null);
  let titleRef = $state<HTMLElement | null>(null);
  let descRef = $state<HTMLElement | null>(null);
  let imageRef = $state<HTMLElement | null>(null);
  let ctaRef = $state<HTMLElement | null>(null);

  let titleVisible = $state(false);
  let descVisible = $state(false);
  let imageVisible = $state(false);
  let ctaVisible = $state(false);

  let hasAnimated = $state(false);

  // Observer le titre (se déclenche à 20% de visibilité)
  useIntersectionObserver(
    () => titleRef,
    (entries) => {
      const entry = entries[0];
      if (entry?.isIntersecting && !hasAnimated) {
        titleVisible = true;
      }
    },
    { threshold: 0.35 },
  );

  // Observer la description (se déclenche à 25% de visibilité)
  useIntersectionObserver(
    () => descRef,
    (entries) => {
      const entry = entries[0];
      if (entry?.isIntersecting && !hasAnimated) {
        descVisible = true;
      }
    },
    { threshold: 0.35 },
  );

  // Observer l'image (se déclenche à 30% de visibilité)
  useIntersectionObserver(
    () => imageRef,
    (entries) => {
      const entry = entries[0];
      if (entry?.isIntersecting && !hasAnimated) {
        imageVisible = true;
      }
    },
    { threshold: 0.35 },
  );

  // Observer le bouton CTA (se déclenche à 35% de visibilité)
  useIntersectionObserver(
    () => ctaRef,
    (entries) => {
      const entry = entries[0];
      if (entry?.isIntersecting && !hasAnimated) {
        ctaVisible = true;
        hasAnimated = true; // Marquer comme animé après le dernier élément
      }
    },
    { threshold: 0.35 },
  );
</script>

<section
  bind:this={sectionRef}
  class="feature-hero my-4 h-[70vh] min-h-[500px] w-full"
>
  <div
    class="hero-grid grid h-full grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center"
  >
    <!-- Côté Image avec carrousel ou image unique -->
    <div
      class="hero-image relative mx-auto flex h-full w-full max-w-2xl items-center justify-center overflow-hidden"
    >
      {#if images.length > 1}
        <!-- Carrousel avec transitions Svelte 5 -->
        <div
          bind:this={imageRef}
          class="carousel relative h-full w-full rounded-xl shadow-2xl transition-all duration-1000 ease-out {imageVisible
            ? 'opacity-100'
            : 'opacity-20'}"
        >
          {#each images as img, i (i)}
            {#if currentIndex === i}
              <div
                class="carousel-item relative h-full w-full"
                transition:fade|global={{ duration: 500 }}
              >
                <img
                  src={img}
                  alt="{title} - Image {i + 1}"
                  class="object-fit h-full w-full"
                />
              </div>
            {/if}
          {/each}

          <!-- Boutons de navigation -->
          <button
            class="btn btn-circle btn-sm absolute top-1/2 left-2 z-10 -translate-y-1/2 opacity-50 transition-opacity hover:opacity-100"
            onclick={prevImage}
          >
            ❮
          </button>
          <button
            class="btn btn-circle btn-sm absolute top-1/2 right-2 z-10 -translate-y-1/2 opacity-50 transition-opacity hover:opacity-100"
            onclick={nextImage}
          >
            ❯
          </button>

          <!-- Indicateurs de position -->
          <div
            class="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2"
          >
            {#each images as _, i (i)}
              <button
                class="h-2 rounded-full transition-all {currentIndex === i
                  ? 'bg-primary w-8'
                  : 'bg-base-300/50 hover:bg-base-300 w-2'}"
                onclick={() => goToImage(i)}
                aria-label="Go to slide {i + 1}"
              ></button>
            {/each}
          </div>
        </div>
      {:else if images.length === 1}
        <!-- Image unique avec animation flip + fade -->
        <div
          bind:this={imageRef}
          class="relative flex h-max justify-center overflow-hidden rounded-xl p-5 transition-all duration-1000 ease-out {imageVisible
            ? 'rotate-y-0 opacity-100'
            : 'rotate-y-20 opacity-20'}"
          style="perspective: 1000px;"
        >
          <img src={images[0]} alt={title} class="object-fit m-5 shadow-xl" />
        </div>
      {/if}
    </div>

    <!-- Côté Contenu avec animations staggered -->
    <div
      class="hero-content relative flex h-full flex-col justify-center p-8 lg:p-12"
    >
      <div class="max-w-xl">
        <!-- Titre : slide depuis la droite + fade (premier) -->
        <h2
          bind:this={titleRef}
          class="card-title {themeClasses[
            theme
          ]} mb-4 text-3xl transition-all duration-1000 ease-out lg:text-4xl {titleVisible
            ? 'translate-x-0 opacity-100'
            : 'translate-x-8 opacity-0'}"
        >
          {title}
        </h2>

        <!-- Description : fade-in (deuxième) -->
        {#if description}
          <p
            bind:this={descRef}
            class="text-base-content/80 mb-6 text-lg transition-all duration-1000 ease-out {descVisible
              ? 'translate-y-0 opacity-100'
              : 'translate-y-4 opacity-0'}"
          >
            {@html description}
          </p>
        {/if}

        {#if extra}
          <div class="mb-6">
            {@render extra()}
          </div>
        {/if}

        <!-- Contenu children supplémentaire -->
        {#if children}
          <div class="mb-6">
            {@render children()}
          </div>
        {/if}

        <!-- Bouton CTA : slide depuis la droite + fade (dernier) -->
        {#if buttonText && buttonAction}
          <div
            bind:this={ctaRef}
            class="flex justify-end transition-all duration-1000 ease-out {ctaVisible
              ? 'translate-x-0 opacity-100'
              : 'translate-x-8 opacity-0'}"
          >
            <button class="btn btn-{theme} btn-lg" onclick={buttonAction}>
              {buttonText}
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</section>
