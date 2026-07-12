import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const webRoot = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.join(webRoot, "src");
const cloneAssetsRoot = path.join(webRoot, "vohive-dist", "assets");
const routeManifest = path.resolve(webRoot, "../internal/api/testdata/reference_routes.tsv");
const httpMethods = new Set(["get", "post", "put", "patch", "delete"]);

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [file] : [];
  });
}

function expressionPath(node) {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) return expressionPath(node.expression);
  if (ts.isConditionalExpression(node)) {
    return expressionPath(node.whenTrue) ?? expressionPath(node.whenFalse);
  }
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map((span) => `:*${span.literal.text}`).join("");
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = expressionPath(node.left);
    const right = expressionPath(node.right);
    if (left !== undefined && right !== undefined) return left + right;
    if (left !== undefined) return left + ":*";
    if (right !== undefined) return ":*" + right;
  }
  return undefined;
}

function objectMethod(node) {
  if (!node || !ts.isObjectLiteralExpression(node)) return "GET";
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property) || property.name.getText() !== "method") continue;
    const value = expressionPath(property.initializer);
    return value ? value.toUpperCase() : "GET";
  }
  return "GET";
}

function normalizeRoute(value) {
  let route = value.split("?", 1)[0];
  const apiIndex = route.indexOf("/api/");
  if (apiIndex >= 0) route = route.slice(apiIndex);
  else if (route.startsWith("/")) route = "/api" + route;
  else return undefined;
  return route
    .replace(/\$\{[^}]+\}/g, ":*")
    .replace(/:[^/]+/g, ":*")
    .replace(/\*[^/]+/g, ":*");
}

function addCall(calls, method, rawPath, file, node, sourceFile) {
  if (!rawPath) return;
  const normalized = normalizeRoute(rawPath);
  if (!normalized) return;
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  calls.set(`${method} ${normalized}`, `${path.relative(webRoot, file)}:${line}`);
}

const calls = new Map();
for (const file of sourceFiles(sourceRoot)) {
  const text = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  function visit(node) {
    if (ts.isCallExpression(node)) {
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.getText(sourceFile) === "api" &&
        httpMethods.has(node.expression.name.text)
      ) {
        addCall(
          calls,
          node.expression.name.text.toUpperCase(),
          expressionPath(node.arguments[0]),
          file,
          node,
          sourceFile,
        );
      } else if (node.expression.getText(sourceFile) === "fetch") {
        addCall(
          calls,
          objectMethod(node.arguments[1]),
          expressionPath(node.arguments[0]),
          file,
          node,
          sourceFile,
        );
      } else if (node.expression.getText(sourceFile) === "useEventStream") {
        const options = node.arguments[0];
        if (options && ts.isObjectLiteralExpression(options)) {
          const property = options.properties.find(
            (item) => ts.isPropertyAssignment(item) && item.name.getText(sourceFile) === "path",
          );
          if (property && ts.isPropertyAssignment(property)) {
            addCall(calls, "GET", expressionPath(property.initializer), file, node, sourceFile);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function quotedValue(match) {
  return match[2] ?? match[3] ?? match[4];
}

function addCloneCall(calls, method, rawPath, file, text, match) {
  if (!rawPath) return;
  let pathValue = rawPath;
  const remainder = text.slice(match.index + match[0].length);
  // Minified code may concatenate a path parameter after a quoted prefix.
  if (/^\s*\+/.test(remainder) && pathValue.endsWith("/")) pathValue += ":*";
  const normalized = normalizeRoute(pathValue);
  if (!normalized) return;
  const line = text.slice(0, match.index).split("\n").length;
  calls.set(`${method} ${normalized}`, `${path.relative(webRoot, file)}:${line}`);
}

const cloneCalls = new Map();
if (!fs.existsSync(cloneAssetsRoot)) {
  console.error(`VoHive clone assets are missing: ${path.relative(webRoot, cloneAssetsRoot)}`);
  process.exit(1);
}

for (const entry of fs.readdirSync(cloneAssetsRoot, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
  const file = path.join(cloneAssetsRoot, entry.name);
  const text = fs.readFileSync(file, "utf8");

  const axiosCall = /\.(get|post|put|patch|delete)\(\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g;
  for (const match of text.matchAll(axiosCall)) {
    addCloneCall(cloneCalls, match[1].toUpperCase(), quotedValue(match), file, text, match);
  }

  const streamPath = /\bpath\s*:\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g;
  for (const match of text.matchAll(streamPath)) {
    const rawPath = match[1] ?? match[2] ?? match[3];
    if (!rawPath.includes("/stream")) continue;
    addCloneCall(cloneCalls, "GET", rawPath, file, text, match);
  }

  const fetchCall = /\bfetch\(\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g;
  for (const match of text.matchAll(fetchCall)) {
    const rawPath = match[1] ?? match[2] ?? match[3];
    const options = text.slice(match.index + match[0].length, match.index + match[0].length + 400);
    const method = options.match(/\bmethod\s*:\s*["'](GET|POST|PUT|PATCH|DELETE)["']/i)?.[1] ?? "GET";
    addCloneCall(cloneCalls, method.toUpperCase(), rawPath, file, text, match);
  }
}

const backendRoutes = new Set(
  fs
    .readFileSync(routeManifest, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [method, route] = line.split("\t");
      return `${method} ${route.replace(/:[^/]+/g, ":*").replace(/\*[^/]+/g, ":*")}`;
    }),
);

const missing = [...calls.entries()].filter(([route]) => !backendRoutes.has(route));
const cloneMissing = [...cloneCalls.entries()].filter(([route]) => !backendRoutes.has(route));
if (missing.length || cloneMissing.length) {
  console.error("Web API calls missing from the Go route contract:");
  for (const [route, location] of missing) console.error(`  ${route} (${location})`);
  for (const [route, location] of cloneMissing) console.error(`  ${route} (${location})`);
  process.exit(1);
}

console.log(
  `API contract OK: ${calls.size} source calls and ${cloneCalls.size} cloned UI calls resolve to Go routes.`,
);
