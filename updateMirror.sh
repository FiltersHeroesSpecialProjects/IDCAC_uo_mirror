#!/bin/bash

MAIN_PATH=$(git -C "$(dirname "$(realpath -s "$1")")" rev-parse --show-toplevel)
cd "$MAIN_PATH" || exit
mkdir -p ./src
cd ./src || exit
wget "https://clients2.google.com/service/update2/crx?response=redirect&prodversion=49.0&acceptformat=crx3&x=id%3Dfihnjjcciajhdojfnbdddfaoknhalnja%26installsource%3Dondemand%26uc" -O "IDCAC.crx"
unzip -o ./IDCAC.crx
rm -rf ./IDCAC.crx
rm -rf ./_metadata
git config --global user.name "${CI_USERNAME}"
git config --global user.email "41898282+github-actions[bot]@users.noreply.github.com"
GIT_SLUG=$(git ls-remote --get-url | sed "s|https://||g" | sed "s|git@||g" | sed "s|:|/|g")
git add --all
git commit -m "Update source code to latest version"
git push https://"${CI_USERNAME}":"${GIT_TOKEN}"@"${GIT_SLUG}" >/dev/null 2>&1
