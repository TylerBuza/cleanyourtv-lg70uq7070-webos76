#!/bin/sh
# Build the directory that gets bind-mounted over LG's Home: the launcher page plus an appinfo.json derived
# from this TV's own stock Home (nothing of LG's is shipped in the repo). Safe to re-run while mounted.
L=${CYTV_DIR:-$(dirname "$(readlink -f "$0")")}
export CYTV_DIR="$L"
[ -f "$L/runtime-env.sh" ] && . "$L/runtime-env.sh"
S=$L/home-overlay
mkdir -p $S
cp $L/app/* $S/
node $L/jtool.js stage "$L/backup/home-appinfo.orig.json" "$S/appinfo.json"
# what scripts/home-standin.sh sends to webapp-mgr where LG's Home is the native program (homeTakeover 'standin')
node $L/jtool.js wamlaunch "$S/appinfo.json" "$S" "$L/wam-launch.json"
node $L/jtool.js nativewrapper "$L" "$L/native-wrapper.sh"
# The web engine is not root, even when setup uses a private umask.
chmod 755 "$S"
chmod 644 "$S"/*
