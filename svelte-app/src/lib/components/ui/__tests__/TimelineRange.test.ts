/**
 * @vitest-environment jsdom
 */

/**
 * TimelineRange — sélection de la plage de dates d'un événement.
 *
 * Contrats de données (ADR 0004) :
 *  - un bouton par date de l'événement ; le clic écrit dans le
 *    DateRangeStore (source de vérité du range) selon la position :
 *    avant le début → étend le début, après la fin → étend la fin,
 *    à l'intérieur → replie sur le jour cliqué ;
 *  - « Dates à venir » (selectUpcoming) et « Toutes les dates »
 *    (selectAll) écrivent le range dérivé correspondant ;
 *  - événement terminé → message « événement terminé », boutons d'action
 *    absents.
 *
 * Seam : vrai composant + vrai DateRangeStore (aucun mock). Dates
 * relatives à maintenant pour rester déterministe ; une interaction par
 * montage.
 */

import { describe, it, expect, afterEach } from "vitest";
import { flushSync } from "svelte";
import TimelineRange from "../TimelineRange.svelte";
import { DateRangeStore } from "$lib/stores/DateRangeStore.svelte";
import { formatDateDayMonthShort } from "$lib/utils/date-helpers";
import {
  mountSvelte,
  cleanupSvelte,
  getByText,
  queryByText,
} from "$lib/test/mount-svelte";

/** Date ISO à midi, décalée de n jours par rapport à maintenant. */
function at(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

const PAST = () => at(-1);
const F1 = () => at(1);
const F2 = () => at(2);
const F3 = () => at(3);

function mountTimeline(
  dates: string[],
  prep?: (store: DateRangeStore) => void,
) {
  const store = new DateRangeStore(dates);
  prep?.(store);
  const target = mountSvelte(TimelineRange, { dateStore: store });
  return { target, store };
}

function dateButton(target: HTMLElement, date: string): HTMLButtonElement {
  return getByText(
    target,
    "button",
    formatDateDayMonthShort(date),
  ) as HTMLButtonElement;
}

describe("TimelineRange — plage de dates", () => {
  afterEach(() => cleanupSvelte());

  it("rend un bouton par date et les deux actions d'aide", () => {
    const { target } = mountTimeline([PAST(), F1(), F2()]);
    getByText(target, "button", formatDateDayMonthShort(PAST()));
    getByText(target, "button", formatDateDayMonthShort(F1()));
    getByText(target, "button", formatDateDayMonthShort(F2()));
    getByText(target, "button", "Dates à venir");
    getByText(target, "button", "Toutes les dates");
  });

  it("cliquer une date à l'intérieur du range replie sur ce jour", () => {
    const { target, store } = mountTimeline([PAST(), F1(), F2()]);
    dateButton(target, F1()).click();
    flushSync();
    expect(store.current.start).toBe(F1());
    expect(store.current.end).toBe(F1());
  });

  it("cliquer avant le début étend le range vers le début", () => {
    const { target, store } = mountTimeline([PAST(), F1(), F2()]);
    dateButton(target, PAST()).click();
    flushSync();
    expect(store.current.start).toBe(PAST());
    expect(store.current.end).toBe(F2());
  });

  it("cliquer après la fin étend le range vers la fin", () => {
    const { target, store } = mountTimeline(
      [PAST(), F1(), F2(), F3()],
      (store) => store.setRange(PAST(), F1()),
    );
    dateButton(target, F3()).click();
    flushSync();
    expect(store.current.start).toBe(PAST());
    expect(store.current.end).toBe(F3());
  });

  it("« Dates à venir » positionne du premier jour futur à la fin", () => {
    const { target, store } = mountTimeline([PAST(), F1(), F2()]);
    getByText(target, "button", "Dates à venir").click();
    flushSync();
    expect(store.current.start).toBe(F1());
    expect(store.current.end).toBe(F2());
  });

  it("« Toutes les dates » couvre la totalité des dates", () => {
    const { target, store } = mountTimeline([PAST(), F1(), F2()]);
    getByText(target, "button", "Toutes les dates").click();
    flushSync();
    expect(store.current.start).toBe(PAST());
    expect(store.current.end).toBe(F2());
  });

  it("événement terminé : message affiché, actions absentes", () => {
    const past3 = at(-3);
    const past2 = at(-2);
    const { target } = mountTimeline([past3, past2]);
    getByText(target, "div", "événement terminé");
    expect(queryByText(target, "button", "Dates à venir")).toBeNull();
    expect(queryByText(target, "button", "Toutes les dates")).toBeNull();
  });
});
