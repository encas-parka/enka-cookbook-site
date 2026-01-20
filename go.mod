module github.com/encas-parka/enka-cookbook-site

// uncomment for dev
//replace github.com/encas-parka/hugo-cookbook-theme => ../hugo-cookbook-theme

go 1.25

// update theme from branch:
// hugo mod clean

// hugo mod get -u github.com/votre-user/votre-theme@nom-de-votre-branche
//
//# 1. Nettoyer complètement si probleme
// rm -rf vendor/
// rm -rf _vendor/

//# 3. Récupérer les modules
//hugo mod get -u

//# 4. Tidy pour nettoyer go.mod
// hugo mod tidy

//# 5. Vendoriser
// hugo mod vendor

require github.com/encas-parka/hugo-cookbook-theme v0.0.0-20260120104932-7c8e07ab90a0 // indirect
