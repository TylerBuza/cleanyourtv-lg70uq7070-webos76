#!/bin/sh
# Run by the inputhook when the Guide button is pressed (and Live TV is on): open the Live TV channel guide over whatever is running.
export PATH=/usr/bin:/usr/sbin:/bin:/sbin:$PATH
L=${CYTV_DIR:-$(dirname "$(readlink -f "$0")")}
export CYTV_DIR="$L"
[ -f "$L/runtime-env.sh" ] && . "$L/runtime-env.sh"
. "$L/luna-compat.sh"
luna_send -n 1 -w 3000 luna://com.webos.applicationManager/launch '{"id":"com.webos.app.home","params":{"live":true,"guide":true}}' >/dev/null 2>&1
