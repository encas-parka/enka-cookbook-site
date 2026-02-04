export interface DemoRecipe {
  recipeUuid: string;
  plates: number;
  typeR: string;
  hasOwnPlatesNb: boolean;
}

export interface DemoMeal {
  recipes: DemoRecipe[];
  guests: number;
  dayOffset: number;
  time: string;
}

export interface DemoEventConfig {
  name: string;
  description: string;
  durationDays: number;
  meals: DemoMeal[];
}

/**
 * ID fixe de l'event de démonstration
 *
 * Cet ID est utilisé pour :
 * - Identifier le mode démo (vs mode normal)
 * - Déterminer les guards de route à appliquer
 * - Décider de l'initialisation du store (public vs auth)
 *
 * @constant
 * @type {string}
 */
export const DEMO_EVENT_ID = "demo-rassemblement-festif";

/**
 * Vérifie si l'eventId correspond à l'event de démonstration
 *
 * @param eventId - L'ID de l'événement à vérifier
 * @returns true si c'est l'event de démo
 */
export function isDemoEvent(eventId?: string | null): boolean {
  return eventId === DEMO_EVENT_ID;
}

export const DEMO_EVENT_CONFIG: DemoEventConfig = {
  name: "Rassemblement festif",
  description:
    "Exemple d'événement sur plusieurs jours, avec plein de recettes...",
  durationDays: 5,
  meals: [
    // ==================== DAY 0 - LUNDI ====================
    {
      // Lunch de bienvenue
      recipes: [
        {
          recipeUuid: "taboule-libanais_izh9n9l14w66",
          plates: 300,
          typeR: "entree",
          hasOwnPlatesNb: false,
        }, // Taboulé libanais (entree)
        {
          recipeUuid: "mafe-vegetarien-et-riz_ij8i8degl1r6",
          plates: 300,
          typeR: "plat",
          hasOwnPlatesNb: false,
        }, // Mafé végétarien (plat)
        {
          recipeUuid: "houmous-pois-chiche_dw7yaqdlvjg9",
          plates: 50,
          typeR: "entree",
          hasOwnPlatesNb: false,
        }, // Houmous pois chiche (entree vegan option)
        {
          recipeUuid: "banoffee-vegan-et-sans_2h83u0xlel3u",
          plates: 300,
          typeR: "dessert",
          hasOwnPlatesNb: false,
        }, // Banoffee vegan (dessert)
      ],
      guests: 300,
      dayOffset: 0,
      time: "12:00",
    },
    {
      // Dîner d'ouverture
      recipes: [
        {
          recipeUuid: "salade-thai-aux-nouill_qv7cxgmhdwiy",
          plates: 250,
          typeR: "entree",
          hasOwnPlatesNb: true,
        }, // Salade thaï aux nouilles de riz (entree)
        {
          recipeUuid: "falafel_n9qzdiwbz4dp",
          plates: 250,
          typeR: "plat",
          hasOwnPlatesNb: true,
        }, // Falafel (plat)
        {
          recipeUuid: "tourte-betterave-lenti_c54ri2ggbvt2",
          plates: 30,
          typeR: "entree",
          hasOwnPlatesNb: true,
        }, // Tourte betterave lentille (entree vegan option)
        {
          recipeUuid: "cheesecake-vegan-citro_lmvlf0ryne1v",
          plates: 250,
          typeR: "dessert",
          hasOwnPlatesNb: true,
        }, // Cheesecake vegan citron framboise (dessert)
      ],
      guests: 250,
      dayOffset: 0,
      time: "19:30",
    },

    // ==================== DAY 1 - MARDI ====================
    {
      // Lunch
      recipes: [
        {
          recipeUuid: "houmous-de-betterave-a_7c1hbo8nci50",
          plates: 280,
          typeR: "entree",
          hasOwnPlatesNb: false,
        }, // Houmous de betterave (entree)
        {
          recipeUuid: "risotto-sarrasin-torre_0ay8dp7smyrw",
          plates: 280,
          typeR: "plat",
          hasOwnPlatesNb: false,
        }, // Risotto sarrasin torréfié (plat)
        {
          recipeUuid: "blanquette-de-soja-tex_1oq9igtwzpr2",
          plates: 40,
          typeR: "plat",
          hasOwnPlatesNb: true,
        }, // Blanquette de soja (plat vegan option)
        {
          recipeUuid: "panna-cotta-vegan-vani_kytwplnialyp",
          plates: 280,
          typeR: "dessert",
          hasOwnPlatesNb: false,
        }, // Panna cotta vegan vanille (dessert)
      ],
      guests: 280,
      dayOffset: 1,
      time: "12:00",
    },
    {
      // Dîner
      recipes: [
        {
          recipeUuid: "taboule-libanais-quino_0zgww2rc17i3",
          plates: 300,
          typeR: "entree",
          hasOwnPlatesNb: false,
        }, // Taboulé libanais quinoa (entree)
        {
          recipeUuid: "curry-veg_xnkksxn0t76q",
          plates: 300,
          typeR: "plat",
          hasOwnPlatesNb: false,
        }, // Curry veg (plat)
        {
          recipeUuid: "escalope-de-seitan_ly3x5wxnq3ve",
          plates: 40,
          typeR: "plat",
          hasOwnPlatesNb: true,
        }, // Escalope de seitan (plat vegan option)
        {
          recipeUuid: "abricots-poches-vervei_izz7yef86m3j",
          plates: 300,
          typeR: "dessert",
          hasOwnPlatesNb: false,
        }, // Abricots pochés verveine (dessert)
      ],
      guests: 300,
      dayOffset: 1,
      time: "19:30",
    },

    // ==================== DAY 2 - MERCREDI ====================
    {
      // Lunch
      recipes: [
        {
          recipeUuid: "taboule-libanais_izh9n9l14w66",
          plates: 200,
          typeR: "entree",
          hasOwnPlatesNb: true,
        }, // Taboulé libanais (entree)
        {
          recipeUuid: "loubia_5m8okqsbqk66",
          plates: 200,
          typeR: "plat",
          hasOwnPlatesNb: true,
        }, // Loubia (plat)
        {
          recipeUuid: "pastilla-vegan-a-laube_do1dg0nokwpd",
          plates: 25,
          typeR: "plat",
          hasOwnPlatesNb: true,
        }, // Pastilla vegan SG (plat vegan option)
        {
          recipeUuid: "lassi-vegan-a-la-mangu_szk3bdykgyra",
          plates: 200,
          typeR: "dessert",
          hasOwnPlatesNb: true,
        }, // Lassi vegan a la mangue (dessert)
      ],
      guests: 200,
      dayOffset: 2,
      time: "12:00",
    },
    {
      // Dîner
      recipes: [
        {
          recipeUuid: "tartinade-de-pois-cass_tgpoyg0cm317",
          plates: 280,
          typeR: "autre",
          hasOwnPlatesNb: false,
        }, // Tartinade pois cassés (entree)
        {
          recipeUuid: "champignons-frits-et-s_j71g5m5afdob",
          plates: 280,
          typeR: "plat",
          hasOwnPlatesNb: false,
        }, // Champignons frits (plat)
        {
          recipeUuid: "steak-vegetarien-champ_g288g77vujzb",
          plates: 45,
          typeR: "plat",
          hasOwnPlatesNb: true,
        }, // Steak végétarien (plat vegan option)
        {
          recipeUuid: "tarte-au-citron-vegane_mw6a5i2da5hf",
          plates: 280,
          typeR: "dessert",
          hasOwnPlatesNb: false,
        }, // Tarte au citron vegane (dessert)
      ],
      guests: 280,
      dayOffset: 2,
      time: "19:30",
    },

    // ==================== DAY 3 - JEUDI ====================
    {
      // Lunch
      recipes: [
        {
          recipeUuid: "soupe-froide-de-courge_nm0vvoqx6bbh",
          plates: 300,
          typeR: "entree",
          hasOwnPlatesNb: false,
        }, // Soupe froide courgettes (entree)
        {
          recipeUuid: "couscous-dautomne-vege_tntsav2ghe2f",
          plates: 300,
          typeR: "plat",
          hasOwnPlatesNb: false,
        }, // Couscous d'automne (plat)
        {
          recipeUuid: "jambalaya-vegan_jai01fvdixw5",
          plates: 30,
          typeR: "plat",
          hasOwnPlatesNb: true,
        }, // Jambalaya vegan (plat vegan option)
        {
          recipeUuid: "creme-de-riz-libanaise_k00sjxzgi6ql",
          plates: 300,
          typeR: "dessert",
          hasOwnPlatesNb: false,
        }, // Creme de riz libanaise (dessert)
      ],
      guests: 300,
      dayOffset: 3,
      time: "12:00",
    },
    {
      // Dîner
      recipes: [
        {
          recipeUuid: "gaspacho_cf5hqia64o1j",
          plates: 250,
          typeR: "entree",
          hasOwnPlatesNb: true,
        }, // Gaspacho (entree)
        {
          recipeUuid: "pastilla-vegan-a-laube_fzejp2oz5xj2",
          plates: 250,
          typeR: "plat",
          hasOwnPlatesNb: true,
        }, // Pastilla vegan a l'aubergine (plat)
        {
          recipeUuid: "bahn-mi-a-la-proteine-_go4i0y6buluy",
          plates: 40,
          typeR: "plat",
          hasOwnPlatesNb: true,
        }, // Bahn mi protéine soja (plat vegan option)
        {
          recipeUuid: "fondant-au-chocolat-ve_0vedt76modbc",
          plates: 250,
          typeR: "dessert",
          hasOwnPlatesNb: true,
        }, // Fondant au chocolat vegan (dessert)
      ],
      guests: 250,
      dayOffset: 3,
      time: "19:30",
    },

    // ==================== DAY 4 - VENDREDI ====================
    {
      // Lunch
      recipes: [
        {
          recipeUuid: "tartinade-de-haricot-r_w8ympby8n43o",
          plates: 300,
          typeR: "autre",
          hasOwnPlatesNb: false,
        }, // Tartinade haricot rouge (entree)
        {
          recipeUuid: "risotto-torrefie-de-sa_slsqvoqaqra7",
          plates: 300,
          typeR: "plat",
          hasOwnPlatesNb: false,
        }, // Risotto torréfié sarrasin (plat)
        {
          recipeUuid: "proteines-de-soja-mari_ggo9802gtbxq",
          plates: 50,
          typeR: "plat",
          hasOwnPlatesNb: true,
        }, // Protéines de soja marinées (plat vegan option)
        {
          recipeUuid: "salami-au-chocolat-veg_gp22v4hamxcv",
          plates: 300,
          typeR: "dessert",
          hasOwnPlatesNb: false,
        }, // Salami au chocolat vegan (dessert)
      ],
      guests: 300,
      dayOffset: 4,
      time: "12:00",
    },
    {
      // Dîner de clôture
      recipes: [
        {
          recipeUuid: "salade-thai-aux-nouill_qv7cxgmhdwiy",
          plates: 300,
          typeR: "entree",
          hasOwnPlatesNb: false,
        }, // Salade thaï aux nouilles de riz (entree)
        {
          recipeUuid: "mafe-vegetarien-et-riz_ij8i8degl1r6",
          plates: 300,
          typeR: "plat",
          hasOwnPlatesNb: false,
        }, // Mafé végétarien (plat)
        {
          recipeUuid: "aubergines-grillees-ca_3y287nb3wv9b",
          plates: 40,
          typeR: "plat",
          hasOwnPlatesNb: true,
        }, // Aubergines grillées cacao (plat vegan option)
        {
          recipeUuid: "creme-vegan-au-sureau_lds9ghlhjlwn",
          plates: 300,
          typeR: "dessert",
          hasOwnPlatesNb: false,
        }, // Crème végan au sureau (dessert)
      ],
      guests: 300,
      dayOffset: 4,
      time: "20:00",
    },
  ],
};
