#!/usr/bin/env bash
# Lift this project out into its own git repository.
#
# It was developed inside another repo because the environment it was built in
# could not create a new one. This extracts it, with its history, into a
# standalone repo you can push wherever you like.
#
#   ./scripts/extract-repo.sh ~/code/bike-quote-runner
set -euo pipefail

DEST="${1:-$HOME/bike-quote-runner}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREFIX="$(basename "$HERE")"
PARENT="$(cd "$HERE/.." && pwd)"

if [ -e "$DEST" ]; then
  echo "refusing to overwrite $DEST" >&2
  exit 1
fi

if git -C "$PARENT" rev-parse --git-dir >/dev/null 2>&1; then
  echo "Splitting $PREFIX/ out of $(basename "$PARENT") with its history..."
  BRANCH="extract-$$"
  git -C "$PARENT" subtree split --prefix="$PREFIX" -b "$BRANCH" >/dev/null
  git clone --quiet "$PARENT" "$DEST" --branch "$BRANCH" --single-branch
  git -C "$PARENT" branch -D "$BRANCH" >/dev/null
  git -C "$DEST" remote remove origin
  git -C "$DEST" branch -m main
else
  echo "No parent repo found; copying files and starting fresh history..."
  mkdir -p "$DEST"
  cp -R "$HERE/." "$DEST/"
  rm -rf "$DEST/node_modules" "$DEST/data" "$DEST/.browser-profiles"
  git -C "$DEST" init -q -b main
  git -C "$DEST" add -A
  git -C "$DEST" commit -qm "bike-quote-runner"
fi

cat <<MSG

Done: $DEST

  cd "$DEST"
  npm install
  gh repo create bike-quote-runner --private --source=. --push
    (or create the repo on github.com, then:)
  git remote add origin git@github.com:<you>/bike-quote-runner.git
  git push -u origin main

MSG
