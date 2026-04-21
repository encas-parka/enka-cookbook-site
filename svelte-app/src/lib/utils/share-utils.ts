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

/**
 * Download or share a file with arbitrary content and MIME type.
 */
export async function downloadFile(
  content: string,
  filename: string,
  mimeType: string,
  successMessage: string,
): Promise<void> {
  const file = new File([content], filename, { type: mimeType });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: filename.replace(/\.[^.]+$/, ""),
      });
      toastService.success(successMessage);
      return;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    }
  }

  const blob = new Blob([content], { type: mimeType });
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

/**
 * Download or share a Markdown file (convenience wrapper).
 */
export async function shareOrDownload(
  markdown: string,
  filename: string,
  successMessage: string,
): Promise<void> {
  return downloadFile(
    markdown,
    filename,
    "text/markdown;charset=utf-8",
    successMessage,
  );
}
