// USELESS : qui appelle ce script ?

const app = new Vue({
	delimiters: ['[[', ']]'],
	el: '#app',
	vuetify: new Vuetify(),
	
	data() {
		return {
			recettes: [
				
				{{- range sort.RegularPagesRecursive ".Title" -}}
			
			{
				title: "{{ .Title }}",
				url: "{{ .RelPermalink }}",
				type: "{{ .Params.type }}",
				categories: [{{- range sort.Params.categories -}} "{{ . }}", {{ - end -}}],
				regimes: [{{- range sort.Params.regime -}} "{{ . }}", {{- end -}}],
				ilegumes: [{{- range.Params.ingredients.legumes -}} "{{ .title }}", {{- end -}}],
				isec: [{{- range.Params.ingredients.sec -}} "{{ .title }}", {{- end -}}],
				ianimaux: [{{- range.Params.ingredients.animaux -}} "{{ .title }}", {{- end -}}
			],
			ilof: [{{- range.Params.ingredients.lof -}} "{{ .title }}", {{- end -}}],
			specialite: " {{ .Params.spécialité }}",
			temperature: "{{ .Params.temperature }}",
			cuisson: "{{ .Params.cuisson }}",
			
		},
		{{ - end -}}
	],
	
	filters: {
		types: [],
		categories: [],
		regimes: [],
		ilegumes: [],
		ianimaux: [],
		isec: [],
		ilof: [],
		cuisson: [],
		temperature: []
	},
	
	
	additiveFiltering: false
}
},
computed: {
	recipes() {
		return this.recettes.map(recipe => ({
			...recipe,
			
		}))
	},
	
	// Liste des items selectable dans les combobox filtres
	ilegumesAllFull() {
		this.allilegumes
	},
	
	filteredRecipes() {
		return this.recipes.filter(
			this.additiveFiltering ?
			p => this.x(this.filters.categories, p.categories).length ||
			this.x(this.filters.regimes, p.regimes).length ||
			this.x(this.filters.ilegumes, p.ilegumes).length ||
			this.x(this.filters.isec, p.isec).length ||
			this.x(this.filters.ianimaux, p.ianimaux).length ||
			this.x(this.filters.ilof, p.ilof).length ||
			this.x(this.filters.cuisson, p.cuisson).length ||
			this.x(this.filters.temperature, p.temperature).length
			:
			p => (!this.filters.categories.length ||
				this.x(this.filters.categories, p.categories).length) &&
				(!this.filters.regimes.length ||
					this.x(this.filters.regimes, p.regimes).length) &&
					(!this.filters.ilegumes.length ||
						this.x(this.filters.ilegumes, p.ilegumes).length) &&
						(!this.filters.isec.length ||
							this.x(this.filters.isec, p.isec).length) &&
							(!this.filters.ianimaux.length ||
								this.x(this.filters.ianimaux, p.ianimaux).length) &&
								
								(!this.filters.ilof.length ||
									this.x(this.filters.ilof, p.ilof).length) &&
									
									(!this.filters.cuisson.length ||
										this.x(this.filters.cuisson, p.cuisson).length) &&
										(!this.filters.temperature.length ||
											this.x(this.filters.temperature, p.temperature).length)
											
											)
										},
										
		filteredLegumes() {
			return this.filters.ilegumes
		},
		filteredAnimaux() {
			return this.filters.ianimaux
		},
		filteredSec() {
			return this.filters.isec
		},
		filteredLof() {
			return this.filters.ilof
		},
		
		
		
		// Pour la fabrication des boutons de filtres
		allcategories() {
			return this.getAll('categories')
		},
		allregimes() {
			return this.getAll('regimes')
		},
		allilegumes() {
			return this.getAll('ilegumes')
		},
		allisec() {
			return this.getAll('isec')
		},
		allianimaux() {
			return this.getAll('ianimaux')
		},
		allilof() {
			return this.getAll('ilof')
		},
		allcuisson(){
			return this.getAll('cuisson')
		},
		alltemperature(){
			return this.getAll('temperature')
		},
		
		
		
		
	},
	
	
	methods: {
		// tags(recipe) {
		//   return [].concat(recipe.categories, recipe.regimes)
		// },
		
		ingredients(recipe) {
			return [].concat(recipe.ilegumes, recipe.isec, recipe.ianimaux, recipe.ilof)
		},
		
		logger(obj) {
			return JSON.stringify(obj, null, 2)
		},
		getAll(prop) {
			return [...new Set([].concat.apply([], this.recettes.map(item => item[prop])))]
		},
		x(arr1, arr2) {
			return arr1.filter(val => arr2.includes(val))
		},
		
		resetFilters: function () {
			this.filters['regimes'] = []
			this.filters['categories'] = []
			this.filters['ilegumes'] = []
			this.filters['ianimaux'] = []
			this.filters['isec'] = []
			this.filters['ilof'] = []
			this.filters['cuisson'] = []
			this.filters['temperature'] = []
		},
		
	}
});