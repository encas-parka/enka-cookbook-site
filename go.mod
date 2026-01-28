module github.com/encas-parka/enka-cookbook-site

go 1.25.5


//uncomment for dev
replace github.com/encas-parka/hugo-cookbook-theme => ../hugo-cookbook-theme

//go 1.25

// update theme from branch:
// hugo mod clean

// hugo mod get -u github.com/encas-parka/hugo-cookbook-theme@enka-next
//# 1. Nettoyer complètement si probleme
// rm -rf vendor/
// rm -rf _vendor/

//# 3. Récupérer les modules
//hugo mod get -u

//# 4. Tidy pour nettoyer go.mod
// hugo mod tidy

//# 5. Vendoriser
// hugo mod vendor

require github.com/encas-parka/hugo-cookbook-theme v0.0.0-20260128224523-735eef582931 // indirect
