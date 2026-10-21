/**
 * @vitest-environment jsdom
 */

/**
 * `readResetTokenEmail` — lecture de l'email porté par un token de
 * réinitialisation PocketBase.
 *
 * Le token est un JWT non signé côté client ; seule sa charge utile nous
 * intéresse (PB y embarque `email`, ce que son dashboard consomme pour
 * afficher le compte). Toute anomalie doit rendre `null` plutôt que lever :
 * la page de reset se rabat alors sur une saisie manuelle.
 */

vi.mock("pocketbase", async () => {
  const { FakePocketBase } =
    await import("../../stores/__tests__/harness/stub-pb");
  return { default: FakePocketBase };
});

import { describe, it, expect, vi } from "vitest";
import { readResetTokenEmail } from "$lib/services/pb-auth";

/** Encode une charge utile comme le fait PocketBase : base64url sans padding. */
function makeToken(claims: Record<string, unknown>): string {
  const encode = (value: string) =>
    Buffer.from(value, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${encode('{"alg":"HS256"}')}.${encode(JSON.stringify(claims))}.sig`;
}

describe("readResetTokenEmail", () => {
  it("lit l'email des claims", () => {
    const token = makeToken({
      id: "userghald00001",
      type: "passwordReset",
      email: "ghald@riseup.net",
    });

    expect(readResetTokenEmail(token)).toBe("ghald@riseup.net");
  });

  it("décode un email non ASCII", () => {
    const token = makeToken({ email: "adele.lefèvre@exemple.fr" });

    expect(readResetTokenEmail(token)).toBe("adele.lefèvre@exemple.fr");
  });

  it("sans claim email ou token illisible : null", () => {
    expect(readResetTokenEmail(makeToken({ id: "userghald00001" }))).toBeNull();
    expect(readResetTokenEmail("pas-un-jwt")).toBeNull();
    expect(readResetTokenEmail("")).toBeNull();
    expect(readResetTokenEmail("a.%%%.c")).toBeNull();
  });
});
