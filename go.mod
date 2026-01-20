module github.com/encas-parka/enka-cookbook-site

// uncomment for dev
//replace github.com/encas-parka/hugo-cookbook-theme => ../hugo-cookbook-theme

go 1.25

require github.com/encas-parka/hugo-cookbook-theme v0.0.0-20260120015614-f2d42847e25c // indirect

// update theme from branch:
// hugo mod clean
// go get github.com/encas-parka/hugo-cookbook-theme@enka-next
// hugo mod tidy
