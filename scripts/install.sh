#!/bin/sh

set -eu

repo="tu95/voHub"
install_root="${VOHUB_INSTALL_ROOT:-/opt/vohub}"
binary_dir="$install_root/bin"
command_path="${VOHUB_COMMAND_PATH:-/usr/local/bin/vohub}"
version="${VOHUB_VERSION:-}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: curl -fsSL https://raw.githubusercontent.com/tu95/voHub/main/scripts/install.sh | sudo bash" >&2
  exit 1
fi

case "$(uname -s)" in
  Linux) os="linux" ;;
  Darwin) os="darwin" ;;
  *)
    echo "Unsupported OS: $(uname -s)" >&2
    exit 1
    ;;
esac

case "$(uname -m)" in
  x86_64|amd64) arch="amd64" ;;
  aarch64|arm64) arch="arm64" ;;
  armv7l|armv7)
    if [ "$os" != "linux" ]; then
      echo "Unsupported architecture: $(uname -m)" >&2
      exit 1
    fi
    arch="armv7"
    ;;
  *)
    echo "Unsupported architecture: $(uname -m)" >&2
    exit 1
    ;;
esac
target="${os}_${arch}"

if [ -z "$version" ]; then
  version=$(curl -fsSL "https://api.github.com/repos/$repo/releases?per_page=1" |
    sed -n 's/^[[:space:]]*"tag_name":[[:space:]]*"\([^"]*\)".*$/\1/p' |
    head -n 1)
  if [ -z "$version" ]; then
    echo "Release not found." >&2
    exit 1
  fi
fi

case "$version" in
  v*) ;;
  *) version="v$version" ;;
esac

asset="vohub_${version}_${target}"
base_url="https://github.com/$repo/releases/download/$version"
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT INT TERM

echo "Downloading voHub $version ($target)..."
curl -fL "$base_url/$asset" -o "$tmp_dir/$asset"
curl -fL "$base_url/$asset.sha256" -o "$tmp_dir/$asset.sha256"

(
  cd "$tmp_dir"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum -c "$asset.sha256"
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 -c "$asset.sha256"
  else
    echo "SHA-256 tool not found." >&2
    exit 1
  fi
)

install -d -m 0755 "$binary_dir" "$install_root/config" "$install_root/data" "$install_root/logs" "$(dirname "$command_path")"
install -m 0755 "$tmp_dir/$asset" "$binary_dir/vohub"

launcher_tmp="$tmp_dir/vohub-launcher"
printf '#!/bin/sh\ncd "%s"\nexec "%s/bin/vohub" "$@"\n' "$install_root" "$install_root" > "$launcher_tmp"
install -m 0755 "$launcher_tmp" "$command_path"

echo
echo "voHub $version installed."
echo "Open http://DEVICE_IP:8000/"
echo "Login: admin / admin"
echo "Config: $install_root/config/config.yaml"
echo "No system service was created."

if [ "${VOHUB_NO_START:-0}" = "1" ]; then
  echo "Run: sudo vohub"
  exit 0
fi

echo
echo "Starting voHub. Press Ctrl+C to stop."
exec "$command_path"
