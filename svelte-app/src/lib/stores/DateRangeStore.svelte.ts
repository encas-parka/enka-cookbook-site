import {
  type DateRange,
  DEFAULT_PURCHASE_MARGIN_HOURS,
} from "../utils/dateRange";

export class DateRangeStore {
  // État interne
  #availableDates = $state<string[]>([]);
  #start = $state<string | null>(null);
  #end = $state<string | null>(null);

  constructor(initialDates: string[] = []) {
    this.#availableDates = initialDates;
    this.initializeSmartRange();
  }

  // Getters d'état
  get start() {
    return this.#start;
  }
  get end() {
    return this.#end;
  }
  get dates() {
    return this.#availableDates;
  }

  // Bornes calculées (définies avant utilisation dans d'autres derived)
  firstAvailableDate = $derived([...this.#availableDates].sort()[0]);
  lastAvailableDate = $derived(
    [...this.#availableDates].sort()[this.#availableDates.length - 1]
  );

  // Objet range pour compatibilité (ou usage direct)
  get current(): DateRange {
    return { start: this.#start, end: this.#end };
  }

  // Dérivés (Calculés automatiquement et mis en cache)
  isEventPassed = $derived.by(() => {
    if (this.#availableDates.length === 0) return true;
    const lastDate = this.lastAvailableDate
      ? new Date(this.lastAvailableDate)
      : new Date();
    lastDate.setHours(23, 59, 59, 999); // Fin de journée
    return lastDate < new Date();
  });

  hasUpcomingDates = $derived.by(() => {
    if (this.#availableDates.length === 0) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.#availableDates.some((date) => new Date(date) >= today);
  });

  isFullRange = $derived(
    this.#start === this.firstAvailableDate &&
      this.#end === this.lastAvailableDate
  );

  isUpcomingRange = $derived.by(() => {
    if (this.#availableDates.length === 0) return false;
    const sortedDates = [...this.#availableDates].sort();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstUpcoming =
      sortedDates.find((date) => new Date(date) >= today) || null;
    let start, end;

    if (!firstUpcoming) {
      const lastDate = sortedDates[sortedDates.length - 1];
      start = lastDate;
      end = lastDate;
    } else {
      start = firstUpcoming;
      end = sortedDates[sortedDates.length - 1];
    }

    return this.#start === start && this.#end === end;
  });

  hasSingleDateEvent = $derived(this.#availableDates.length === 1);

  hasSingleDateInRange = $derived(
    !!(this.#start && this.#start === this.#end)
  );

  hasPastDatesInRange = $derived.by(() => {
    if (!this.#start || !this.#end) return false;
    if (this.isEventPassed) return false; // Totalement passé = autre cas

    // 🎯 Vérifier si la PREMIÈRE date du range est passée (avec marge)
    // Si le début de la plage est déjà passée, on masque les boutons d'action
    const startWithMargin = new Date(this.#start);
    startWithMargin.setHours(startWithMargin.getHours() + DEFAULT_PURCHASE_MARGIN_HOURS);
    return startWithMargin < new Date();
  });



  // Actions
  setAvailableDates(dates: string[]) {
    this.#availableDates = dates;
    this.initializeSmartRange();
  }

  setRange(date1: string | null, date2: string | null) {
    if (!date1 && !date2) {
      this.#start = null;
      this.#end = null;
      return;
    }

    if (!date1 || !date2) {
      // Un seul cas, on l'utilise pour les deux
      const date = date1 || date2;
      this.#start = date;
      this.#end = date;
      return;
    }

    // Déterminer automatiquement start/end selon l'ordre chronologique
    const start = new Date(date1) <= new Date(date2) ? date1 : date2;
    const end = new Date(date1) >= new Date(date2) ? date1 : date2;

    this.#start = start;
    this.#end = end;
  }

  selectAll() {
    if (this.#availableDates.length === 0) return;
    this.#start = this.#availableDates[0];
    this.#end = this.#availableDates[this.#availableDates.length - 1];
  }

  selectUpcoming() {
    if (this.#availableDates.length === 0) return;

    const sortedDates = [...this.#availableDates].sort();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstUpcoming =
      sortedDates.find((date) => new Date(date) >= today) || null;

    if (!firstUpcoming) {
      // Si aucune date future, on prend la dernière date disponible
      const lastDate = sortedDates[sortedDates.length - 1];
      this.#start = lastDate;
      this.#end = lastDate;
    } else {
      // Sinon on prend du premier événement futur jusqu'au dernier
      this.#start = firstUpcoming;
      this.#end = sortedDates[sortedDates.length - 1];
    }
  }

  selectFutureDatesOnly() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    // Trouver la première date disponible à partir de demain
    const futureDates = this.#availableDates.filter(
      (date) => new Date(date) >= tomorrow
    );

    if (futureDates.length > 0) {
      this.#start = futureDates[0];
      this.#end = futureDates[futureDates.length - 1];
    }
  }

  initializeSmartRange() {
    if (this.#availableDates.length === 0) return;

    const sortedDates = [...this.#availableDates].sort();
    const eventPassed = this.isEventPassed;
    const isFirstDatePassed = new Date(sortedDates[0]) < new Date();

    const today = new Date();
    let startDate: string;

    if (eventPassed) {
      startDate = sortedDates[0];
    } else if (isFirstDatePassed) {
      startDate = today.toISOString().slice(0, 19) + "Z";
    } else {
      startDate = sortedDates[0];
    }

    this.#start = startDate;
    this.#end = sortedDates[sortedDates.length - 1];

    console.log(
      `[DateRangeStore] Initialized: ${this.#start} - ${this.#end}`,
    );
  }

  /**
   * Réinitialise complètement le store.
   * Appelée lors du changement d'événement.
   */
  reset() {
    this.#availableDates = [];
    this.#start = null;
    this.#end = null;
    console.log("[DateRangeStore] Reset");
  }
}
