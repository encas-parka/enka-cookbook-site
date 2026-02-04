/**
 * Attachment pour détecter les clics à l'extérieur d'un élément
 * @returns Cleanup function pour supprimer les écouteurs d'événements
 */
export function clickOutside(element: HTMLElement) {
  return function (callback: () => void) {
    // Vérifier que l'élément est valide
    if (!element || typeof element.contains !== "function") {
      console.warn("clickOutside: element invalide");
      return { destroy: () => {} };
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (!element.contains(target)) {
        callback();
      }
    }

    document.addEventListener("click", handleClick, true);

    return {
      destroy() {
        document.removeEventListener("click", handleClick, true);
      },
    };
  };
}
