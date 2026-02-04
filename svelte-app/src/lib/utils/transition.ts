import { cubicInOut } from "svelte/easing";

// Transition smooth pour carrousel
export function carouselSlide(node, { duration = 500, direction = 1 } = {}) {
  return {
    duration,
    easing: cubicInOut,
    css: (t) => `
      opacity: ${t};
      transform: translateX(${(1 - t) * direction * 30}px);
    `,
  };
}

// Transition pour le contenu staggered
export function slideInUp(node, { duration = 600, delay = 0 } = {}) {
  return {
    duration,
    delay,
    easing: cubicInOut,
    css: (t) => `
      opacity: ${t};
      transform: translateY(${(1 - t) * 20}px);
    `,
  };
}
