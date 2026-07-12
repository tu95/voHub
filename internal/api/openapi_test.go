package api

import (
	"os"
	"sort"
	"strings"
	"testing"

	"github.com/tu95/vohub/internal/config"
	"gopkg.in/yaml.v3"
)

func TestOpenAPIvoHubYAMLValid(t *testing.T) {
	data, err := os.ReadFile("openapi.vohub.yaml")
	if err != nil {
		t.Fatalf("read openapi.vohub.yaml: %v", err)
	}
	var doc map[string]any
	if err := yaml.Unmarshal(data, &doc); err != nil {
		t.Fatalf("openapi.vohub.yaml is invalid YAML: %v", err)
	}
	if doc["openapi"] == "" {
		t.Fatalf("openapi.vohub.yaml missing openapi version")
	}
}

func TestOpenAPIOperationsMatchRegisteredAPIRoutes(t *testing.T) {
	data, err := os.ReadFile("openapi.vohub.yaml")
	if err != nil {
		t.Fatalf("read openapi.vohub.yaml: %v", err)
	}
	var doc struct {
		Paths map[string]map[string]any `yaml:"paths"`
	}
	if err := yaml.Unmarshal(data, &doc); err != nil {
		t.Fatalf("parse openapi.vohub.yaml: %v", err)
	}

	httpMethods := map[string]bool{
		"get": true, "post": true, "put": true, "patch": true, "delete": true, "head": true,
	}
	documented := make(map[string]bool)
	for routePath, pathItem := range doc.Paths {
		for method := range pathItem {
			method = strings.ToLower(method)
			if httpMethods[method] {
				documented[strings.ToUpper(method)+" "+canonicalContractPath("/api"+routePath)] = true
			}
		}
	}

	registered := make(map[string]bool)
	for _, route := range (&Server{cfg: config.ServerConfig{}}).newRouter().Routes() {
		// OPTIONS /logs/stream is a CORS transport helper, not a resource operation.
		if !strings.HasPrefix(route.Path, "/api/") || route.Method == "OPTIONS" {
			continue
		}
		registered[route.Method+" "+canonicalContractPath(route.Path)] = true
	}

	missingFromDocs := setDifference(registered, documented)
	missingFromRouter := setDifference(documented, registered)
	if len(missingFromDocs) != 0 || len(missingFromRouter) != 0 {
		t.Fatalf(
			"OpenAPI and registered /api routes differ\nmissing from OpenAPI:\n%s\n\nmissing from router:\n%s",
			strings.Join(missingFromDocs, "\n"), strings.Join(missingFromRouter, "\n"),
		)
	}
	if len(registered) != 95 {
		t.Fatalf("registered API operation count=%d want 95", len(registered))
	}
}

func canonicalContractPath(value string) string {
	parts := strings.Split(value, "/")
	for i, part := range parts {
		if strings.HasPrefix(part, ":") || strings.HasPrefix(part, "*") ||
			(strings.HasPrefix(part, "{") && strings.HasSuffix(part, "}")) {
			parts[i] = "{}"
		}
	}
	return strings.Join(parts, "/")
}

func setDifference(left, right map[string]bool) []string {
	var result []string
	for item := range left {
		if !right[item] {
			result = append(result, item)
		}
	}
	sort.Strings(result)
	return result
}
