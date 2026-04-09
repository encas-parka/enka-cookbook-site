export type CatalogType =
  | "electronic"
  | "manual"
  | "other"
  | "tools"
  | "dish"
  | "cooking"
  | "gaz"
  | "hygiene";

export interface CatalogItem {
  name: string;
  type: CatalogType;
}

export const MATERIEL_CATALOG: CatalogItem[] = [
  // ==========================================================================
  // Cuisine — Gastro (au four)
  // ==========================================================================
  { name: "Gastro 1/1 (5cm)", type: "cooking" },
  { name: "Gastro 1/1 (10cm)", type: "cooking" },
  { name: "Gastro 1/1 (15cm)", type: "cooking" },
  { name: "Gastro 1/1 (20cm)", type: "cooking" },
  { name: "Gastro 1/1 Couvercles", type: "cooking" },
  { name: "Gastro 1/2 (5cm)", type: "cooking" },
  { name: "Gastro 1/2 (10cm)", type: "cooking" },
  { name: "Gastro 1/2 (15cm)", type: "cooking" },
  { name: "Gastro 1/3 (5cm)", type: "cooking" },
  { name: "Gastro 1/3 (10cm)", type: "cooking" },
  { name: "Gastro 1/4 (5cm)", type: "cooking" },
  { name: "Gastro 1/6 (10cm)", type: "cooking" },
  { name: "Gastro 1/9 (5cm)", type: "cooking" },

  // ==========================================================================
  // Cuisine — Passoires (au four)
  // ==========================================================================
  { name: "Passoire 1/1 Fine (6,5cm)", type: "cooking" },
  { name: "Passoire 1/1 Moyenne (10cm)", type: "cooking" },
  { name: "Passoire 1/1 Grande (20cm)", type: "cooking" },

  // ==========================================================================
  // Cuisine — Gamelles (au feu)
  // ==========================================================================
  { name: "Gamelle Inox 20L", type: "cooking" },
  { name: "Gamelle Inox 30L", type: "cooking" },
  { name: "Gamelle Inox 40L", type: "cooking" },
  { name: "Gamelle Inox 50L", type: "cooking" },
  { name: "Gamelle Inox 80L", type: "cooking" },
  { name: "Gamelle Inox 100L", type: "cooking" },
  { name: "Gamelle Inox 120L", type: "cooking" },
  { name: "Gamelle Alu 20L", type: "cooking" },
  { name: "Gamelle Alu 30L", type: "cooking" },
  { name: "Gamelle Alu 40L", type: "cooking" },
  { name: "Gamelle Alu 50L", type: "cooking" },
  { name: "Gamelle Alu 80L", type: "cooking" },
  { name: "Gamelle Alu 100L", type: "cooking" },
  { name: "Gamelle Alu 120L", type: "cooking" },

  // ==========================================================================
  // Cuisine — Plats (au four)
  // ==========================================================================
  { name: "Plat à Pizza 40cm", type: "cooking" },
  { name: "Plat à Pizza 60cm", type: "cooking" },
  { name: "Plat à Pizza 80cm", type: "cooking" },
  { name: "Plat à Pizza 100cm", type: "cooking" },

  // ==========================================================================
  // Cuisine — Couvercles
  // ==========================================================================
  { name: "Couvercle 1/1 avec Poignée", type: "cooking" },
  { name: "Couvercle 1/2", type: "cooking" },
  { name: "Couvercle 1/3", type: "cooking" },
  { name: "Couvercle Gamelle Petit", type: "cooking" },
  { name: "Couvercle Gamelle Moyen", type: "cooking" },
  { name: "Couvercle Gamelle Grand", type: "cooking" },

  // ==========================================================================
  // Manual — Ustensiles préparation
  // ==========================================================================
  { name: "Coupe Frites Petit", type: "manual" },
  { name: "Coupe Frites Grand", type: "manual" },
  { name: "Hachoir", type: "manual" },
  { name: "Essoreuse à Salade Normale", type: "manual" },
  { name: "Essoreuse à Salade Grande", type: "manual" },
  { name: "Économe", type: "manual" },
  { name: "Économe Castor", type: "manual" },
  { name: "Rouleau à Pâtisserie", type: "manual" },
  { name: "Rouleau à Pâtisserie Grand", type: "manual" },
  { name: "Planche à Découper Bois", type: "manual" },
  { name: "Planche à Découper Grande Bois", type: "manual" },
  { name: "Planche à Découper Plastique", type: "manual" },
  { name: "Planche à Découper Grande Plastique", type: "manual" },

  // ==========================================================================
  // Tools — Outils
  // ==========================================================================
  { name: "Caisse à Outils", type: "tools" },
  { name: "Pince Multiprise", type: "tools" },
  { name: "Pince Universelle", type: "tools" },
  { name: "Tournevis Cruciforme", type: "tools" },
  { name: "Tournevis Plat", type: "tools" },
  { name: "Clé Plate", type: "tools" },
  { name: "Clé Plate Grande", type: "tools" },
  { name: "Stylo", type: "tools" },
  { name: "Marqueur", type: "tools" },
  { name: "Véléda", type: "tools" },
  { name: "Extincteur", type: "tools" },
  { name: "Couverture Anti-Feu", type: "tools" },
  { name: "Trousse Premiers Soins", type: "tools" },

  // ==========================================================================
  // Électronique
  // ==========================================================================
  { name: "Bain Marie Simple", type: "electronic" },
  { name: "Bain Marie Double", type: "electronic" },
  { name: "Bras Plongeur", type: "electronic" },
  { name: "Mixer Plongeant Familial", type: "electronic" },
  { name: "Robocoupe", type: "electronic" },
  { name: "Lames Robocoupe", type: "electronic" },
  { name: "Four Gastro 220V", type: "electronic" },
  { name: "Frigo Gastro 1 Porte", type: "electronic" },
  { name: "Frigo Gastro 2 Portes", type: "electronic" },
  { name: "Four Gastro Triphasé", type: "electronic" },
  { name: "Friteuse Triphasé", type: "electronic" },
  { name: "Ricecooker Normal", type: "electronic" },
  { name: "Ricecooker Grand", type: "electronic" },
  { name: "Plancha Électrique", type: "electronic" },
  { name: "Plancha Électrique Grand", type: "electronic" },
  { name: "Frigo Domestique Petit", type: "electronic" },
  { name: "Frigo Domestique Grand", type: "electronic" },
  { name: "Bac Congélateur", type: "electronic" },
  { name: "Congélateur Vertical", type: "electronic" },
  { name: "Four Domestique", type: "electronic" },
  { name: "Saladette 2 Portes", type: "electronic" },
  { name: "Saladette 3 Portes", type: "electronic" },

  // ==========================================================================
  // Gaz
  // ==========================================================================
  { name: "Friteuse Double Bac À Gaz", type: "gaz" },
  { name: "Trépied Gaz (30cm)", type: "gaz" },
  { name: "Trépied Gaz (40cm)", type: "gaz" },
  { name: "Trépied Gaz (60cm)", type: "gaz" },
  { name: "Trépied Gaz (80cm)", type: "gaz" },
  { name: "Bouteilles De Gaz Butane", type: "gaz" },
  { name: "Bouteilles De Gaz Propane", type: "gaz" },
  { name: "Détendeur Gaz à vis Propane", type: "gaz" },
  { name: "Détendeur Gaz à clic Propane", type: "gaz" },
  { name: "Détendeur à vis Gaz Butane", type: "gaz" },
  { name: "Détendeur à clic Gaz Butane", type: "gaz" },
  { name: "Marmite Bain-Marie", type: "gaz" },
  { name: "Gazinière", type: "gaz" },
  { name: "Four Domestique Gaz", type: "gaz" },
  { name: "Plancha Gaz", type: "gaz" },
  { name: "Plancha Gaz Grand", type: "gaz" },
  { name: "Sauteuse Basculante Pro", type: "gaz" },

  // ==========================================================================
  // Vaisselle
  // ==========================================================================
  { name: "Assiette Plate", type: "dish" },
  { name: "Petite Assiette", type: "dish" },
  { name: "Assiette Creuse", type: "dish" },
  { name: "Fourchette", type: "dish" },
  { name: "Couteau", type: "dish" },
  { name: "Cuillère", type: "dish" },
  { name: "Grande Cuillère", type: "dish" },
  { name: "Bol", type: "dish" },
  { name: "Ramequin", type: "dish" },
  { name: "Tasse", type: "dish" },
  { name: "Verre", type: "dish" },
  { name: "Plateau", type: "dish" },
  { name: "Bouteille", type: "dish" },

  // ==========================================================================
  // Hygiène
  // ==========================================================================
  { name: "Gant", type: "hygiene" },
  { name: "Tablier", type: "hygiene" },
  { name: "Charlotte", type: "hygiene" },
  { name: "Casquette", type: "hygiene" },
  { name: "Torchon", type: "hygiene" },

  // ==========================================================================
  // Transport
  // ==========================================================================
  { name: "Caddy", type: "other" },
  { name: "Caisse Plastique Petite", type: "other" },
  { name: "Caisse Plastique Moyenne", type: "other" },
  { name: "Caisse Plastique Grande", type: "other" },
  { name: "Caisse Bois Petite", type: "other" },
  { name: "Caisse Bois Moyenne", type: "other" },
  { name: "Caisse Bois Grande", type: "other" },

  // ==========================================================================
  // Autre
  // ==========================================================================
  { name: "Bassine (~2L)", type: "other" },
  { name: "Bassine (~5L)", type: "other" },
  { name: "Bassine (~10L)", type: "other" },
  { name: "Bassine (~20L)", type: "other" },
  { name: "Bassine (~40L)", type: "other" },
  { name: "Sceau Alim 5L", type: "other" },
  { name: "Sceau Alim 10L", type: "other" },
  { name: "Sceau Alim 15L", type: "other" },
  { name: "Sceau Alim 25L", type: "other" },
  { name: "Évier Platique", type: "other" },
  { name: "Évier Grand", type: "other" },
  { name: "Évier Inox 1 Bac", type: "other" },
  { name: "Évier Inox 2 Bacs", type: "other" },
  { name: "Plan De Travail Inox", type: "other" },
  { name: "Poubelle À Pied", type: "other" },
  { name: "Tableau", type: "other" },
  { name: "Tableau Véléda", type: "other" },
  { name: "Barnum 3m x 3m", type: "other" },
  { name: "Barnum 4m x 4m", type: "other" },
  { name: "Barnum 6m x 6m", type: "other" },
  { name: "Barnum 5m x 8m", type: "other" },
  { name: "Desserte", type: "other" },
  { name: "Table Pliante Bois", type: "other" },
  { name: "Table Pliante Plastique", type: "other" },
  { name: "Étagère Métal", type: "other" },
  { name: "Étagère Bois", type: "other" },
];

export type CatalogTypeGroup = {
  type: CatalogType;
  label: string;
  icon: string;
  defaultOpen: boolean;
};

export const CATALOG_TYPE_GROUPS: CatalogTypeGroup[] = [
  { type: "cooking", label: "Cuisine", icon: "Soup", defaultOpen: true },
  { type: "manual", label: "Ustensiles", icon: "ChefHat", defaultOpen: false },
  { type: "tools", label: "Outils", icon: "Wrench", defaultOpen: false },
  { type: "dish", label: "Vaisselle", icon: "Utensils", defaultOpen: false },
  {
    type: "electronic",
    label: "Électronique",
    icon: "Zap",
    defaultOpen: false,
  },
  { type: "gaz", label: "Gaz", icon: "Flame", defaultOpen: false },
  { type: "hygiene", label: "Hygiène", icon: "Hand", defaultOpen: false },
  { type: "other", label: "Autre", icon: "Package", defaultOpen: false },
];
