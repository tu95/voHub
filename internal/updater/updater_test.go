package updater

import "testing"

func TestLatestReleaseAPIURLUsesCurrentRepository(t *testing.T) {
	const want = "https://api.github.com/repos/tu95/vohive-release/releases/latest"
	if got := latestReleaseAPIURL(); got != want {
		t.Fatalf("latestReleaseAPIURL() = %q, want %q", got, want)
	}
}
