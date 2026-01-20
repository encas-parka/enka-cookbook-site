module github.com/encas-parka/enka-cookbook-site

// uncomment for dev
//replace github.com/encas-parka/hugo-cookbook-theme => ../hugo-cookbook-theme

go 1.25

// update theme from branch:
//// hugo mod clean
// go get github.com/encas-parka/hugo-cookbook-theme@enka-next
//ou ? 
// hugo mod get -u github.com/votre-user/votre-theme@nom-de-votre-branche
// hugo mod vendor
// hugo mod tidy

require github.com/encas-parka/hugo-cookbook-theme v0.0.0-20260120100614-59fc84504d92 // indirect
