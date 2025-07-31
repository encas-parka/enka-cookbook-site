 const app = new Vue ({
    delimiters: ['[[', ']]'],
    el: '#app',
    vuetify: new Vuetify(),
    data () {
      return {
        search: '',
        selected: [],
        datesRepas: [], // liste des dates entre 1er et dernier repas : pour les date marqué event dans le date-picker
        startDate: null, // re-initialisé dans mounted().
        endDate: null,
        startDateSelected: null,
        endDateSelected: null, 
        endDateSelectedDebug: null,
        endDateAllowed: null,
        startDateMenu: false,
        endDateMenu: false,
        showAllRow: false,
        ingredientsTypesList: [{{ print $IngredientsTypesList }}],
        recettes: [
        {{/* Création de la liste des recettes, et des données de chacunes, en réccupérant la liste recettesList créer par Hugo. */}} 
          {{- range $recettesList -}}
            {
              recette: "{{ .recette }}",
              dateService: "{{ .dateService }}",
              horaire: "{{ .horaire }}",
              typePlat: "{{ .typePlat }}",
              chef: "{{ .chef }}",
              commentaire: "{{ .commentaire }}",
              assiettesRepas: {{ .assiettesRepas }},
          {{/* On reccupère l'url correspondant au nom de la recette... */}}
              {{- $url:= print .recette | urlize -}}
              {{- with site.GetPage $url -}}
              {{- $regime:= .Params.regime  -}}
              regime: "{{ $regime }}",
              specialite: "{{ .Params.spécialité }}",
              temperature: "{{ .Params.temperature }}",
              preparation: "{{ .Params.preparation }}",
              prepAlt: "{{ .Params.prepAlt }}",
              img: {{ .Params.img }}, 
              {{- $assiettesRecettes:= .Params.plate -}}
              assiettesRecettes: "{{ $assiettesRecettes }}",
              ingredients: [
              {
                {{- range $key, $value := .Params.ingredients -}}
                //Pour creer les parametres ingredientLofs, ingredientsSec...
                  {{ print "ingredient" ( $key | strings.FirstUpper ) }}: 
                  [
                    {{- range . }}
                    { 
                      ing: "{{ .title }}",
                      quantite: "{{ .quantite }}", //
                      unit: "{{ .unit }}",
                    },
                    {{- end }}
                  ],
                {{- end -}}
              },
              ]
              {{ end }} {{/* {{ with site.GetPage $url }} */}}
           }, // Ne pas oublier la virgule, puisqu'il s'agit d'une boucle, il y a plusieur objets dans la liste recettes
          {{ end }}
        ],

        ingredientsRecettes: [
          {{ range $IngredientList }}
          {
            ingredient: "{{ .ingredient }}",
            ingredientType: "{{ .ingType }}",
            unit: "{{ .unit }}",
            quantite: {{ .quantite }},
            recette: "{{ .recette }}",
            dateService:'{{ .dateService }}',
            horaire: "{{ .horaire }}",
            typePlat: "{{ .typePlat }}",
            assiettesRecettes: {{ .assiettesRecettes }},
            assiettesRepas: {{ .assiettesRepas }},
          },
          {{ end }}
          ],
        
        totalsEachIngredientHeaders: [
          { text: 'Ingrédient', value: 'ingredient' },
          { text: 'par recette', value: 'recette'},
          { text: 'Quantité totale', value: 'total', align: 'right' },
          ],

        IngredientsRepasHeaders: [
          { text: "Ingredient", value: "name", filterable: true},
          { text: "", value: "ingredient", filterable: true},
          { text: "Recette", value: "recette"},
          { text: "quantité", align: "end", filterable: false, value: "quantite" },
          ], 

          displayDetails: true,

          select: ['Recettes', "Ingrédients"],
          printable: [
            'Recettes',
            'Ingrédients',
            'Affiches'
          ], 
          printRecettes: true,
          printIngredients: true,
          printAffiches: false,

          printDialog: false,

          showedSection: ['recettes', 'ingredients'],
          isActive : null

       
  } {{/* return */}}    
}, {{/* data */}}

mounted () {

  datesRange: {
    // Trouver la première et la dernière date dans les données
    this.startDate = new Date(Math.min(
      ...this.ingredients.map(i => {
        return new Date(i.dateService);
      }),
      ),
    );
    this.endDate = new Date(Math.max(
      ...this.ingredients.map(i => {
        return new Date(i.dateService);
      }),
      ),
    );

    this.startDate = new Date(this.startDate).toISOString().substr(0, 10);
    this.endDate = new Date(this.endDate).toISOString().substr(0, 10);

    this.startDateSelected = this.startDate;

    // Défini le derniers jour sélectionner par défaut (pour l'interval de date pris en compte dans le calcul des totaux). Il faut ajouter un jour supplémentaire à l'intervalle des date de repas, car sinon le dernier jour sélectionné n'est pas pris en compte (bug lié à vuetify ?) lors du filtre opéré par totalsIngredientFiltered. Donc, on reprend endDate comme lastDate, qu'on insere dans un `new Date` dans lequel on ajoute un jour, avant de reformater pour vuetify.
    this.endDateSelected = this.endDate

    // Derniere date autorisée dans la sélection (ne sera pas mutable puisque dans `mounted:`
    this.endDateAllowed = this.endDateSelected;


  };

  datesRepasGen: {
    // Creer un tableau avec toutes les dateService, éliminer les doublon (Set). Défini le parametre `datesRepas` de `data()`, pour mettre en evidence dles date où il y a des évenement dans les date-picker; TODO : est-ce encore utile maintenant que les `allowed-dates` fonctionne bien ? doublon ? Ne creer pas les date intermédiare si il y a des trou =>
    const dates = this.ingredients.map(i => {
      const datesFormat = i.dateService;
      return new Date(datesFormat).toISOString().substr(0, 10) // formatage
    });

    this.datesRepas = Array.from(new Set(dates)).sort(); 
};


  endDateDebugGen: {
    /* Ajoute un jour a la endDateSelected, pour que les derniers jours soit bien pris en compte par le filtre opéré dans totalsIngredientFiltered.
    Meme fonction dans watch() pour la mise a jour en fonction de la selection dans le date-picker */
    const lastDateSelected = new Date(this.endDateSelected)
    this.endDateSelectedDebug = new Date(lastDateSelected.setDate(lastDateSelected.getDate() + 1 )).toISOString().substr(0, 10);
  };

}, // mounted() end




computed: { 

  ingredients: function () {
  // let ingredients = this.ingredientsRecettes; // USELESS ?!
  return this.ingredientsRecettes.map(ingredient => {
  let quantite = this.computeQuantite(ingredient);
  return {
    recette: ingredient.recette,
    dateService: ingredient.dateService,
    horaire: ingredient.horaire,
    typePlat: ingredient.typePlat,
    ingredient: ingredient.ingredient,
    ingredientType: ingredient.ingredientType,
    unit: ingredient.unit,
    quantite: quantite,
    assiettesRepas: ingredient.assiettesRepas,
  }
});
},
}, // computed end

watch: {

  endDateSelected: function () {
    /* Ajoute un jour a la endDateSelected, pour que les derniers jours soit bien pris en compte par le filtre opéré dans totalsIngredientFiltered. 
    Meme fonction dans mounted() pour l'initialisation ! Doit etre dans watch() sinon les changement de endDateSelected ne sont pas pris en compte... */ 
    const lastDateSelected = new Date(this.endDateSelected)
    this.endDateSelectedDebug = new Date(lastDateSelected.setDate(lastDateSelected.getDate() + 1 )).toISOString().substr(0, 10);
  },


}, // watch() end


methods: { 

  showSection (el) {
    this.showedSection = el ;
    this.isActive = el ;
  },

  printSection (el) {
    this.select.push(el)
  },

  printableElements() {
    if (this.select.includes('Recettes')) {
      this.printRecettes = true;
    } else {this.printRecettes = false}

    if (this.select.includes('Ingrédients')) {
      this.printIngredients = true;
    } else {this.printIngredients = false}

    if (this.select.includes('Affiches')) {
      this.printAffiches = true;
    } else {this.printAffiches = false}
  },

  print() {
    this.printDialog = false;
    window.print();
  },




  updateSelectedAttribute (e) {
    let sel, i;

    sel = document.getElementById(e.target.id);
          // remove 'selected' from prior user selection
    for (i = 0; i < sel.length; i += 1) {
      sel[i].removeAttribute("selected");
    }
          // and add 'selected' to current selection
    sel[sel.selectedIndex].setAttribute("selected", "selected");
  },

  datesReset: function () {
    this.startDateSelected = this.startDate;
    this.endDateSelected = this.endDateAllowed;
  },

  computeQuantite: function (ingredient) {
   // Recalcule les quantité d'ingredients en fonctions du nombre d'assietes prévues  
    let x = (Number(ingredient.quantite) * Number(ingredient.assiettesRepas)) / Number(ingredient.assiettesRecettes);
    if (typeof ingredient.quantite != "number") {
      ingredient.quantite = '-';
    } else if (ingredient.unit == "Kg" || ingredient.unit == "litre") {
      ingredient.quantite = Math.round(x * 100) / 100;
    } else if (ingredient.unit == "grammes") {
      ingredient.quantite = Math.round(x);
      if (ingredient.quantite > 1000) {
        ingredient.unit = "Kg"
        ingredient.quantite = ingredient.quantite / 1000      
      }
    } else {
      ingredient.quantite = Math.round(x * 10) / 10;
    }
    return ingredient.quantite;
  },

  convertToKg: function (quantite, unit) {
    return quantite / 1000;
  },

  totalsIngredientFiltered: function (iType) {
  // Creer un tableau des totals de chaques ingrédients lorsque leurs unités ne sont pas différentes. Si Kg et grammes: conversion en Kg avec convertToKg()
  // TODO : Diviser la fonction en plusieurs fonctions : 1 par filtre et calcul ensuite ?    
 
    const totals = this.ingredients.filter(i => i.ingredientType === iType && i.dateService >= this.startDateSelected && i.dateService <= this.endDateSelectedDebug);
    totals.forEach((item) => {
      if (!totals[item.ingredient]) { 
        totals[item.ingredient] = {
          unitTotal: item.unit,
          total: 0,
        };
      } 
      if (totals[item.ingredient].unitTotal === item.unit) {
        totals[item.ingredient].total += item.quantite;

      } else if (item.unit === 'grammes' && totals[item.ingredient].unitTotal === 'Kg') {
        // Convertir la quantité en Kg avant de l'ajouter au total
        const total = this.convertToKg(item.quantite);
        totals[item.ingredient].total += total;
        totals[item.ingredient].unitTotal = 'Kg'


      } else { // si les unité ne peuvent pas s'additionné / sont de différentes nature...
        totals[item.ingredient] = {
          total: "Incalculable...",
          unitTotal: undefined,
        }; 
      }

      // Arrondir a 2 décimale
      if (typeof totals[item.ingredient].total === "number" ) {
        const rounded = totals[item.ingredient].total ;
        totals[item.ingredient].total = Math.round(rounded * 100) / 100;
      } else if (totals[item.ingredient].total === "Incalculable..." ) {
        return;
      } else { // si les quantité sont manquante (comme pour des épices...)
        totals[item.ingredient].total = "non présisé"
      }

    });
    // renvoyer la map avec les nouveaux parametres
    return Object.entries(totals).map(([ingredient, { unitTotal, total, ...item}]) => ({ ingredient, unitTotal, total, ...item}));
  },



  ingredientTypeList () {
    return [...new Set (this.ingredients.map(ingredient => ingredient.ingredientType))];
  },


  datesAllowedRange: function (val) {
// retourne toutes les dates comprisent entre la premiere et la dernieres =>
    for(
      var datesAllowedArray=[],
      date=new Date(this.startDate); 
      date <= new Date(this.endDateAllowed); 
      date.setDate(date.getDate()+1)){
        datesAllowedArray.push(new Date(date).toISOString().substr(0, 10));
      }

    for (var i = 0; i < datesAllowedArray.length; i++) {
      if (datesAllowedArray[i] == val ){
        return val
      };
    }
  },


} {{/* fin de methods */}}
}); {{/* fin New Vue */}}