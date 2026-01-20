module github.com/encas-parka/enka-cookbook-site

// uncomment for dev
//replace github.com/encas-parka/hugo-cookbook-theme => ../hugo-cookbook-theme

go 1.24

require (
	github.com/encas-parka/hugo-cookbook-theme v0.0.0-20260120010647-c1bb3649d8cc // indirect
)

// update theme from branch:
// go get github.com/encas-parka/hugo-cookbook-theme@enka-next
// hugo mod get -u
