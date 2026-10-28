#!/bin/sh
# Optional native-only lifecycle: the upstream stand-in, no SAM restart or Python.
export PATH=/usr/bin:/usr/sbin:/bin:/sbin:$PATH
L=${CYTV_DIR:-$(dirname "$(readlink -f "$0")")}
export CYTV_DIR="$L"
[ -f "$L/runtime-env.sh" ] && . "$L/runtime-env.sh"
[ "${CYTV_NATIVE_ONLY:-0}" = 1 ] || { echo 'native-only mode is not configured' >&2; exit 1; }
case "$1" in
    enable) rm -f "$L/DISABLE"; exec /bin/sh "$L/10-cleanyourtv-home" ;;
    disable) (umask 077; touch "$L/DISABLE"); exec /bin/sh "$L/undo-home.sh" ;;
    *) echo 'usage: native-home.sh enable|disable' >&2; exit 2 ;;
esac
