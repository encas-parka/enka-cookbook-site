module github.com/encas-parka/enka-cookbook-site

// uncomment for dev
//replace github.com/encas-parka/hugo-cookbook-theme => ../hugo-cookbook-theme

go 1.25

// update theme from branch:
// hugo mod clean
// go get github.com/encas-parka/hugo-cookbook-theme@enka-next
// hugo mod tidy

require github.com/encas-parka/hugo-cookbook-theme v0.0.0-20260120010647-c1bb3649d8cc // indirect
