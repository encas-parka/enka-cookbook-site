export interface ConversionResult {
  quantity: number;
  unit: string;
  originalUnit: string;
  ruleUsed?: string;
  hasConversion: boolean;
}

export class UnitConverter {
  // Règles de conversion (Portage fidèle de quantite-converter.html)
  private static readonly CONVERSION_RULES: Record<string, number> = {
    // Cuillère à café (5ml par défaut)
    "cafe_sucre": 5,
    "cafe_sel": 5,
    "cafe_farine": 3,
    "cafe_semoule": 4,
    "cafe_poivre": 2.5,
    "cafe_cacao": 2.5,
    "cafe_sucre_glace": 3,
    "cafe_maizena": 3,
    "cafe_bicarbonate": 5,
    "cafe_curcuma": 2,
    "cafe_cumin": 2,
    "cafe_curry": 2,
    "cafe_muscade": 2,
    "cafe_paprika": 2,
    "cafe_miel": 10,
    "cafe_creme_epaisse": 5,
    "cafe_default": 5,

    // Cuillère à soupe (15ml par défaut)
    "soupe_sucre": 15,
    "soupe_sel": 15,
    "soupe_farine": 10,
    "soupe_semoule": 12,
    "soupe_poivre": 8,
    "soupe_cacao": 8,
    "soupe_sucre_glace": 9,
    "soupe_maizena": 10,
    "soupe_creme_epaisse": 15,
    "soupe_bicarbonate": 15,
    "soupe_curcuma": 6,
    "soupe_cumin": 6,
    "soupe_curry": 6,
    "soupe_muscade": 7,
    "soupe_paprika": 6,
    "soupe_miel": 30,
    "soupe_default": 15,

    // Autres unités
    "pincee": 0.4,
    "gousse_ail": 6.5,
    "tete_ail": 80,

    // Unités à la pièce
    "unite_oignon": 120,
    "unite_ail": 6.5,
    "unite_tomate": 120,
    "unite_poireau": 150,
    "unite_aubergine": 250,
    "unite_courgette": 200,
    "unite_eshalote": 30,
    "unite_orange": 200,
    "unite_citron": 100,
    "unite_concombre": 200,
    "unite_levure_chimique": 11,
    "unite_carotte": 125,
    "unite_betterave_rouge": 250
  };

  /**
   * Normalise et convertit une quantité vers l'unité de base (gr. ou ml)
   */
  static normalize(quantity: number, unit: string, ingredientName: string = ""): ConversionResult {
    const unitLower = unit.toLowerCase();
    const ingLower = ingredientName.toLowerCase();
    
    // Détection du type d'unité
    const isCafe = unitLower.includes("caf");
    const isSoupe = unitLower.includes("soupe");
    const isPincee = unitLower.includes("pinc");
    const isGousse = unitLower.includes("gousse");
    const isTete = unitLower.includes("tête");
    const isUnite = unitLower.includes("unit") || unitLower === "pièce" || unitLower === "piece";

    // Détection du type d'ingrédient (Optimisé pour correspondre au template Hugo)
    const isSucre = ingLower.includes("sucre");
    const isSel = ingLower.includes("sel");
    const isFarine = ingLower.includes("farine");
    const isCremeEpaisse = ingLower.includes("crème épaisse") || ingLower.includes("creme epaisse");
    const isAil = ingLower === "ail"; // Strict pour éviter de matcher "ail des ours" ou autre si besoin, mais Hugo utilisait eq
    const isOignon = ingLower.includes("oignon");
    const isTomate = ingLower === "tomate";
    const isPoireau = ingLower === "poireau";
    const isAubergine = ingLower.includes("aubergine");
    const isCourgette = ingLower === "courgette";
    const isEchalote = ingLower === "échalote" || ingLower === "echalote";
    const isOrange = ingLower === "orange" && !ingLower.includes("jus");
    const isCitron = ingLower.includes("citron") && !ingLower.includes("jus");
    const isConcombre = ingLower === "concombre";
    const isLevureChimique = ingLower === "levure chimique";
    const isCarotte = ingLower === "carotte";
    const isBetteraveRouge = ingLower === "betterave rouge";

    // Autres détections spécifiques pour les règles
    const isSemoule = ingLower.includes("semoule");
    const isPoivre = ingLower.includes("poivre");
    const isCacao = ingLower.includes("cacao");
    const isSucreGlace = ingLower.includes("sucre glace");
    const isMaizena = ingLower.includes("maizena") || ingLower.includes("maïzena");
    const isBicarbonate = ingLower.includes("bicarbonate");
    const isCurcuma = ingLower.includes("curcuma");
    const isCumin = ingLower.includes("cumin");
    const isCurry = ingLower.includes("curry");
    const isMuscade = ingLower.includes("muscade");
    const isPaprika = ingLower.includes("paprika");
    const isMiel = ingLower.includes("miel");


    let quantityEq = quantity;
    let unitEq = unit;
    let hasConversion = false;
    let conversionRule = "";
    let baseUnit = "";

    // --- Logique de conversion ---

    if (isCafe) {
      hasConversion = true;
      let ruleKey = "cafe_default";
      baseUnit = "ml"; // Par défaut liquide

      if (isSucre) { ruleKey = "cafe_sucre"; baseUnit = "gr."; }
      else if (isSel) { ruleKey = "cafe_sel"; baseUnit = "gr."; }
      else if (isFarine) { ruleKey = "cafe_farine"; baseUnit = "gr."; }
      else if (isSemoule) { ruleKey = "cafe_semoule"; baseUnit = "gr."; }
      else if (isPoivre) { ruleKey = "cafe_poivre"; baseUnit = "gr."; }
      else if (isCacao) { ruleKey = "cafe_cacao"; baseUnit = "gr."; }
      else if (isSucreGlace) { ruleKey = "cafe_sucre_glace"; baseUnit = "gr."; }
      else if (isMaizena) { ruleKey = "cafe_maizena"; baseUnit = "gr."; }
      else if (isBicarbonate) { ruleKey = "cafe_bicarbonate"; baseUnit = "gr."; }
      else if (isCurcuma) { ruleKey = "cafe_curcuma"; baseUnit = "gr."; }
      else if (isCumin) { ruleKey = "cafe_cumin"; baseUnit = "gr."; }
      else if (isCurry) { ruleKey = "cafe_curry"; baseUnit = "gr."; }
      else if (isMuscade) { ruleKey = "cafe_muscade"; baseUnit = "gr."; }
      else if (isPaprika) { ruleKey = "cafe_paprika"; baseUnit = "gr."; }
      else if (isMiel) { ruleKey = "cafe_miel"; baseUnit = "gr."; }
      else if (isCremeEpaisse) { ruleKey = "cafe_creme_epaisse"; baseUnit = "ml"; }

      quantityEq = quantity * this.CONVERSION_RULES[ruleKey];
      conversionRule = `1 c. à café = ${this.CONVERSION_RULES[ruleKey]} ${baseUnit}`;

    } else if (isSoupe) {
      hasConversion = true;
      let ruleKey = "soupe_default";
      baseUnit = "ml";

      if (isSucre) { ruleKey = "soupe_sucre"; baseUnit = "gr."; }
      else if (isSel) { ruleKey = "soupe_sel"; baseUnit = "gr."; }
      else if (isFarine) { ruleKey = "soupe_farine"; baseUnit = "gr."; }
      else if (isSemoule) { ruleKey = "soupe_semoule"; baseUnit = "gr."; }
      else if (isPoivre) { ruleKey = "soupe_poivre"; baseUnit = "gr."; }
      else if (isCacao) { ruleKey = "soupe_cacao"; baseUnit = "gr."; }
      else if (isSucreGlace) { ruleKey = "soupe_sucre_glace"; baseUnit = "gr."; }
      else if (isMaizena) { ruleKey = "soupe_maizena"; baseUnit = "gr."; }
      else if (isCremeEpaisse) { ruleKey = "soupe_creme_epaisse"; baseUnit = "ml"; }
      else if (isBicarbonate) { ruleKey = "soupe_bicarbonate"; baseUnit = "gr."; }
      else if (isCurcuma) { ruleKey = "soupe_curcuma"; baseUnit = "gr."; }
      else if (isCumin) { ruleKey = "soupe_cumin"; baseUnit = "gr."; }
      else if (isCurry) { ruleKey = "soupe_curry"; baseUnit = "gr."; }
      else if (isMuscade) { ruleKey = "soupe_muscade"; baseUnit = "gr."; }
      else if (isPaprika) { ruleKey = "soupe_paprika"; baseUnit = "gr."; }
      else if (isMiel) { ruleKey = "soupe_miel"; baseUnit = "gr."; }

      quantityEq = quantity * this.CONVERSION_RULES[ruleKey];
      conversionRule = `1 c. à soupe = ${this.CONVERSION_RULES[ruleKey]} ${baseUnit}`;

    } else if (isPincee) {
      hasConversion = true;
      baseUnit = "gr.";
      quantityEq = quantity * this.CONVERSION_RULES["pincee"];
      conversionRule = "1 pincée = 0.4 gr.";

    } else if (isGousse && isAil) {
      hasConversion = true;
      baseUnit = "gr.";
      quantityEq = quantity * this.CONVERSION_RULES["gousse_ail"];
      conversionRule = "1 gousse = 6.5 gr.";

    } else if (isTete && isAil) {
      hasConversion = true;
      baseUnit = "gr.";
      quantityEq = quantity * this.CONVERSION_RULES["tete_ail"];
      conversionRule = "1 tête = 80 gr.";

    } else if (isUnite) {
      hasConversion = true;
      baseUnit = "gr.";
      let ruleKey = "";

      if (isOignon) ruleKey = "unite_oignon";
      else if (isAil) ruleKey = "unite_ail";
      else if (isTomate) ruleKey = "unite_tomate";
      else if (isPoireau) ruleKey = "unite_poireau";
      else if (isAubergine) ruleKey = "unite_aubergine";
      else if (isCourgette) ruleKey = "unite_courgette";
      else if (isEchalote) ruleKey = "unite_eshalote";
      else if (isOrange) ruleKey = "unite_orange";
      else if (isCitron) ruleKey = "unite_citron";
      else if (isConcombre) ruleKey = "unite_concombre";
      else if (isLevureChimique) ruleKey = "unite_levure_chimique";
      else if (isCarotte) ruleKey = "unite_carotte";
      else if (isBetteraveRouge) ruleKey = "unite_betterave_rouge";
      else {
        hasConversion = false; // Pas de règle spécifique trouvée
      }

      if (hasConversion) {
        quantityEq = quantity * this.CONVERSION_RULES[ruleKey];
        conversionRule = `1 unité = ${this.CONVERSION_RULES[ruleKey]} gr.`;
      }
    }

    // --- Normalisation des unités standard ---
    if (!hasConversion) {
      if (unitLower === "kg") {
        quantityEq = quantity * 1000;
        unitEq = "gr.";
      } else if (unitLower === "l.") {
        quantityEq = quantity * 1000;
        unitEq = "ml";
      } else if (unitLower === "gr.") {
        unitEq = "gr.";
      } else if (unitLower === "ml") {
        unitEq = "ml";
      }
    } else {
      unitEq = baseUnit;
    }

    return {
      quantity: quantityEq,
      unit: unitEq,
      originalUnit: unit,
      ruleUsed: conversionRule,
      hasConversion
    };
  }
}
