<script lang="ts">
  import { useIntersectionObserver } from "runed";

  interface Feature {
    id: string;
    title: string;
    description: string;
    items?: string[];
    screenshot: string;
    buttonText?: string;
    buttonAction?: () => void;
    theme?: "primary" | "secondary";
  }

  interface Props {
    features: Feature[];
  }

  let { features }: Props = $props();

  // Refs pour chaque section
  let sectionRefs: (HTMLElement | undefined)[] = $state(
    new Array(features.length).fill(undefined),
  );
  let activeIndex = $state(0);

  // Créer un observer pour chaque section
  features.forEach((_, index) => {
    useIntersectionObserver(
      () => sectionRefs[index],
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          activeIndex = index;
        }
      },
      {
        threshold: 0.3,
        rootMargin: "-30% 0px -30% 0px",
      },
    );
  });

  // Classes de thème pour les boutons
  const themeBtnClasses = (theme: "primary" | "secondary" = "primary") => {
    return theme === "primary" ? "btn-primary" : "btn-secondary";
  };
</script>

<section class="from-base-200 to-base-100 relative bg-gradient-to-b py-20">
  <div class="container mx-auto px-4">
    <h2
      class="text-base-content mb-20 text-center text-4xl font-bold md:text-5xl"
    >
      Fonctionnalités Principales
    </h2>

    <div class="flex flex-col gap-12 lg:flex-row lg:items-start lg:gap-16">
      <!-- Screenshot fixe (sticky) -->
      <div class="lg:w-1/2">
        <div
          class="bg-base-300 relative aspect-video overflow-hidden rounded-2xl shadow-2xl lg:sticky lg:top-24"
        >
          {#each features as feature, i}
            <img
              src={feature.screenshot}
              alt={feature.title}
              class="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out"
              class:opacity-0={activeIndex !== i}
              class:opacity-100={activeIndex === i}
            />
          {/each}
        </div>
      </div>

      <!-- Contenu qui scrolle -->
      <div class="space-y-32 pb-[40vh] lg:w-1/2">
        {#each features as feature, i}
          <div
            bind:this={sectionRefs[i]}
            class="flex min-h-[60vh] items-center transition-all duration-700 ease-out"
            class:opacity-100={activeIndex === i}
            class:translate-y-0={activeIndex === i}
            class:opacity-30={activeIndex !== i}
            class:translate-y-8={activeIndex > i}
            class:-translate-y-8={activeIndex < i}
          >
            <div class="w-full space-y-6">
              <!-- Titre -->
              <h3
                class="text-base-content text-3xl font-bold transition-all delay-100 duration-700 md:text-4xl"
                class:translate-x-0={activeIndex === i}
                class:opacity-100={activeIndex === i}
                class:-translate-x-8={activeIndex !== i}
              >
                {feature.title}
              </h3>

              <!-- Description -->
              <p
                class="text-base-content/70 text-lg leading-relaxed transition-all delay-200 duration-700"
                class:translate-x-0={activeIndex === i}
                class:opacity-100={activeIndex === i}
                class:-translate-x-8={activeIndex !== i}
              >
                {feature.description}
              </p>

              <!-- Liste optionnelle -->
              {#if feature.items}
                <ul class="mt-8 space-y-3">
                  {#each feature.items as item, j}
                    <li
                      class="text-base-content flex items-start gap-3 transition-all duration-700"
                      style="transition-delay: {300 + j * 100}ms"
                      class:translate-x-0={activeIndex === i}
                      class:opacity-100={activeIndex === i}
                      class:-translate-x-8={activeIndex !== i}
                      class:opacity-0={activeIndex !== i}
                    >
                      <svg
                        class="text-primary mt-0.5 h-6 w-6 flex-shrink-0"
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

              <!-- Bouton optionnel -->
              {#if feature.buttonText && feature.buttonAction}
                <div
                  class="mt-8 transition-all delay-300 duration-700"
                  class:translate-x-0={activeIndex === i}
                  class:opacity-100={activeIndex === i}
                  class:-translate-x-8={activeIndex !== i}
                  class:opacity-0={activeIndex !== i}
                >
                  <button
                    class="btn btn-lg {themeBtnClasses(feature.theme)}"
                    onclick={feature.buttonAction}
                  >
                    {feature.buttonText}
                  </button>
                </div>
              {/if}

              <!-- Indicateur de progression -->
              <div class="mt-8 flex gap-2">
                {#each features as _, idx}
                  <div
                    class="h-1 rounded-full transition-all duration-500"
                    class:w-12={activeIndex === idx}
                    class:w-8={activeIndex !== idx}
                    class:bg-primary={activeIndex === idx}
                    class:bg-base-300={activeIndex !== idx}
                  ></div>
                {/each}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</section>

<style>
  /* Amélioration du smooth scroll global */
  :global(html) {
    scroll-behavior: smooth;
  }
</style>
