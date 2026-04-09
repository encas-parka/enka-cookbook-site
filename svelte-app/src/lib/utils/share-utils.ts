import { toastService } from "$lib/services/toast.service.svelte";

export const materielTypeLabels: Record<string, string> = {
  electronic: "Électronique",
  manual: "Manuel",
  other: "Autre",
  tools: "Outils",
  dish: "Vaisselle",
  cooking: "Cuisine",
  gaz: "Gaz",
  hygiene: "Hygiène",
};

export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function shareOrDownload(
  markdown: string,
  filename: string,
  successMessage: string,
): Promise<void> {
  const file = new File([markdown], filename, {
    type: "text/markdown;charset=utf-8",
  });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: filename.replace(/\.md$/, ""),
      });
      toastService.success(successMessage);
      return;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    }
  }

  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toastService.success(successMessage);
}
