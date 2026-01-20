module github.com/encas-parka/enka-cookbook-site

// uncomment for dev
//replace github.com/encas-parka/hugo-cookbook-theme => ../hugo-cookbook-theme

go 1.25

// update theme from branch:
// hugo mod clean
// go get github.com/encas-parka/hugo-cookbook-theme@enka-next
// hugo mod tidy

require github.com/encas-parka/hugo-cookbook-theme v0.0.0-20260120021705-0b46291953a1 // indirect
