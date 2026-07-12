BINARY_NAME ?= vohub
GO_TAGS ?= with_utls nomsgpack
GOOS ?= linux
CGO_ENABLED ?= 0
VERSION ?= v1.0.0
VERSION_TAG = $(if $(filter v%,$(VERSION)),$(VERSION),v$(VERSION))
BUILD_TIME ?= $(shell date "+%Y-%m-%d %H:%M:%S")
DIST_DIR ?= dist
MAIN_PACKAGE ?= ./cmd/vohub

LDFLAGS = -s -w -X 'github.com/tu95/vohub/internal/global.Version=$(VERSION)' -X 'github.com/tu95/vohub/internal/global.BuildTime=$(BUILD_TIME)'
GO_BUILD = go build -trimpath -buildvcs=false -tags "$(GO_TAGS)" -ldflags "$(LDFLAGS)"

AMD64_OUT = $(DIST_DIR)/$(BINARY_NAME)_$(VERSION_TAG)_linux_amd64
ARM64_OUT = $(DIST_DIR)/$(BINARY_NAME)_$(VERSION_TAG)_linux_arm64
ARMV7_OUT = $(DIST_DIR)/$(BINARY_NAME)_$(VERSION_TAG)_linux_armv7
MAC_ARM64_OUT = $(DIST_DIR)/$(BINARY_NAME)_$(VERSION_TAG)_darwin_arm64
MAC_ARM64_ARCHIVE = $(MAC_ARM64_OUT).tar.gz
MAC_ARM64_SHA256 = $(MAC_ARM64_ARCHIVE).sha256
MAC_AMD64_OUT = $(DIST_DIR)/$(BINARY_NAME)_$(VERSION_TAG)_darwin_amd64
MAC_AMD64_ARCHIVE = $(MAC_AMD64_OUT).tar.gz
MAC_AMD64_SHA256 = $(MAC_AMD64_ARCHIVE).sha256
UPX ?= $(shell command -v upx || command -v upx-ucl)
UPX_FLAGS ?= --best --lzma

.PHONY: all build build-amd64 build-arm64 build-armv7 mac-arm64 mac-amd64 build-mac-arm64 build-mac-amd64 build-darwin-arm64 build-darwin-amd64 build-all package-mac-arm64 package-mac-amd64 verify-mac-arm64 verify-mac-amd64 test test-web test-mac-arm64 test-mac-amd64 frontend-dist clean

all: build-all

test: test-web frontend-dist
	go test ./...

test-web:
	npm test --prefix web
	npm run test:contract --prefix web
	npm run typecheck --prefix web
	npm run lint --prefix web

build: build-amd64

build-all: build-amd64 build-arm64 build-armv7 build-mac-arm64 build-mac-amd64

frontend-dist:
	test -f web/vohive-dist/index.html
	npm run build --prefix web
	rm -rf internal/web/dist
	mkdir -p internal/web
	cp -R web/dist internal/web/dist

build-amd64: frontend-dist
	mkdir -p $(DIST_DIR)
	CGO_ENABLED=$(CGO_ENABLED) GOOS=$(GOOS) GOARCH=amd64 $(GO_BUILD) -o $(AMD64_OUT) $(MAIN_PACKAGE)
	@test -z "$(UPX)" || $(UPX) $(UPX_FLAGS) $(AMD64_OUT)

build-arm64: frontend-dist
	mkdir -p $(DIST_DIR)
	CGO_ENABLED=$(CGO_ENABLED) GOOS=$(GOOS) GOARCH=arm64 $(GO_BUILD) -o $(ARM64_OUT) $(MAIN_PACKAGE)
	@test -z "$(UPX)" || $(UPX) $(UPX_FLAGS) $(ARM64_OUT)

build-armv7: frontend-dist
	mkdir -p $(DIST_DIR)
	CGO_ENABLED=$(CGO_ENABLED) GOOS=$(GOOS) GOARCH=arm GOARM=7 $(GO_BUILD) -o $(ARMV7_OUT) $(MAIN_PACKAGE)
	@test -z "$(UPX)" || $(UPX) $(UPX_FLAGS) $(ARMV7_OUT)

build-mac-arm64: frontend-dist
	mkdir -p $(DIST_DIR)
	CGO_ENABLED=$(CGO_ENABLED) GOOS=darwin GOARCH=arm64 $(GO_BUILD) -o $(MAC_ARM64_OUT) $(MAIN_PACKAGE)

build-mac-amd64: frontend-dist
	mkdir -p $(DIST_DIR)
	CGO_ENABLED=$(CGO_ENABLED) GOOS=darwin GOARCH=amd64 $(GO_BUILD) -o $(MAC_AMD64_OUT) $(MAIN_PACKAGE)

# Short alias for local use: `make mac-arm64 VERSION=...`.
mac-arm64: build-mac-arm64

mac-amd64: build-mac-amd64

# Keep the platform name available for callers that use Go's GOOS/GOARCH
# spelling while retaining build-mac-arm64 for the user-facing target.
build-darwin-arm64: build-mac-arm64

build-darwin-amd64: build-mac-amd64

verify-mac-arm64: build-mac-arm64
	@file $(MAC_ARM64_OUT) | grep -Eq 'Mach-O.*arm64' || { echo "unexpected target in $(MAC_ARM64_OUT)" >&2; file $(MAC_ARM64_OUT); exit 1; }
	@test -x $(MAC_ARM64_OUT) || { echo "$(MAC_ARM64_OUT) is not executable" >&2; exit 1; }
	@echo "verified $$(file $(MAC_ARM64_OUT))"

verify-mac-amd64: build-mac-amd64
	@file $(MAC_AMD64_OUT) | grep -Eq 'Mach-O.*x86_64' || { echo "unexpected target in $(MAC_AMD64_OUT)" >&2; file $(MAC_AMD64_OUT); exit 1; }
	@test -x $(MAC_AMD64_OUT) || { echo "$(MAC_AMD64_OUT) is not executable" >&2; exit 1; }
	@echo "verified $$(file $(MAC_AMD64_OUT))"

package-mac-arm64: verify-mac-arm64
	tar -czf $(MAC_ARM64_ARCHIVE) -C $(DIST_DIR) $(notdir $(MAC_ARM64_OUT))
	@if command -v shasum >/dev/null 2>&1; then (cd $(DIST_DIR) && shasum -a 256 $(notdir $(MAC_ARM64_ARCHIVE)) > $(notdir $(MAC_ARM64_SHA256))); \
	elif command -v sha256sum >/dev/null 2>&1; then (cd $(DIST_DIR) && sha256sum $(notdir $(MAC_ARM64_ARCHIVE)) > $(notdir $(MAC_ARM64_SHA256))); \
	else echo "warning: neither shasum nor sha256sum is installed; skipping checksum" >&2; fi
	@echo "created $(MAC_ARM64_ARCHIVE)"

package-mac-amd64: verify-mac-amd64
	tar -czf $(MAC_AMD64_ARCHIVE) -C $(DIST_DIR) $(notdir $(MAC_AMD64_OUT))
	@if command -v shasum >/dev/null 2>&1; then (cd $(DIST_DIR) && shasum -a 256 $(notdir $(MAC_AMD64_ARCHIVE)) > $(notdir $(MAC_AMD64_SHA256))); \
	elif command -v sha256sum >/dev/null 2>&1; then (cd $(DIST_DIR) && sha256sum $(notdir $(MAC_AMD64_ARCHIVE)) > $(notdir $(MAC_AMD64_SHA256))); \
	else echo "warning: neither shasum nor sha256sum is installed; skipping checksum" >&2; fi
	@echo "created $(MAC_AMD64_ARCHIVE)"

test-mac-arm64:
	CGO_ENABLED=$(CGO_ENABLED) GOOS=darwin GOARCH=arm64 go test ./...

test-mac-amd64:
	CGO_ENABLED=$(CGO_ENABLED) GOOS=darwin GOARCH=amd64 go test ./...

clean:
	go clean
	rm -rf $(DIST_DIR)
