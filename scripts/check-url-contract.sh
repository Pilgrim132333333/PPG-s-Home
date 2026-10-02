#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
check_root="$(mktemp -d)"
trap 'rm -rf "${check_root}"' EXIT

dev_dir="${check_root}/development"
prod_dir="${check_root}/production"

cd "${project_root}"

hugo \
  --environment development \
  --baseURL "http://127.0.0.1:1313/" \
  --destination "${dev_dir}" \
  --quiet

hugo \
  --environment production \
  --destination "${prod_dir}" \
  --quiet

dev_index="${dev_dir}/index.html"
prod_index="${prod_dir}/index.html"

if rg -q '(href|src)="/PPG-s-Home/' "${dev_index}"; then
  echo "Development build leaked the GitHub Pages subpath." >&2
  exit 1
fi

if ! rg -q '(href|src)="/(css|js|lib)/' "${dev_index}"; then
  echo "Development build did not generate root-relative assets." >&2
  exit 1
fi

if ! rg -q '(href|src)="/PPG-s-Home/(css|js|lib)/' "${prod_index}"; then
  echo "Production build is missing the GitHub Pages subpath." >&2
  exit 1
fi

echo "URL contract OK: local assets use /; production assets use /PPG-s-Home/."
