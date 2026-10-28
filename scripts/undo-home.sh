#!/bin/sh
# Restore LG's stock Home. "temp": until next reboot only; no arg: also create DISABLE so reboots keep stock Home.
export PATH=/usr/bin:/usr/sbin:/bin:/sbin:$PATH
L=${CYTV_DIR:-$(dirname "$(readlink -f "$0")")}
export CYTV_DIR="$L"
[ -f "$L/runtime-env.sh" ] && . "$L/runtime-env.sh"
. "$L/luna-compat.sh"
printf '%s\n' disabled > "$L/home-generation"
[ "$1" = temp ] || touch "$L/DISABLE" "$L/DISABLE-DEBLOAT"
# our apps must not be what the TV tries to come back to: close them and point the boot's "last app" at LG's Home
for id in com.cleanyourtv.manager com.cleanyourtv.picker com.cleanyourtv.notify; do
  luna_send -n 1 -w 3000 luna://com.webos.applicationManager/closeByAppId "{\"id\":\"$id\"}" >/dev/null 2>&1
done
LASTAPP=/var/luna/preferences/bootd_last_foreground_app_id.json
grep -q cleanyourtv $LASTAPP 2>/dev/null && echo '{"lastAppId":"com.webos.app.home"}' > $LASTAPP
# LG's own Home needs the ad services the debloat blocks (it fails to start without them), so lift the debloat first
if [ "${CYTV_EXTERNAL_DEBLOAT:-0}" != 1 ] && [ -f "$L/debloat-undo.sh" ]; then sh "$L/debloat-undo.sh" </dev/null >/dev/null 2>&1; fi
# the stand-in way (LG's native Home): unmount it from LG's Home program and close the launcher; sam was never restarted
STANDIN=/tmp/cleanyourtv-home-standin
if [ -f $STANDIN ] && grep -q " $(cat $STANDIN) " /proc/mounts; then
  EXE=$(cat $STANDIN)
  node "$L/nativehome.js" stop "$EXE" || exit 1
  umount "$EXE" || { echo 'Native Home mount is still busy; marker retained for recovery' >&2; exit 1; }
  rm -f "$STANDIN"
  luna_send -n 1 -w 5000 luna://com.palm.webappmanager/killApp '{"appId":"com.webos.app.home"}' >/dev/null 2>&1
  echo "$(cut -d' ' -f1 /proc/uptime) undo-home: the stand-in is removed from $EXE" >> /tmp/cleanyourtv-boot.log
  sleep 2
  luna_send -n 1 -w 10000 -f luna://com.webos.applicationManager/launch '{"id":"com.webos.app.home"}' >/dev/null
  echo "stock Home restored; rm $L/DISABLE to re-enable at next boot"
  exit 0
fi
[ "${CYTV_NATIVE_ONLY:-0}" != 1 ] || { echo 'No active native stand-in; refusing a SAM-restart fallback' >&2; exit 1; }
for m in $(awk '$2 ~ /applications\/com.webos.app.home$/ {print $2}' /proc/mounts | sort -r); do umount $m 2>/dev/null; done
# an airplay child of sam makes the stop wait ~90 s; kill it once the stop has begun
(sleep 3; pkill -9 -f /usr/palm/applications/airplay/LunaExecutable) </dev/null >/dev/null 2>&1 &
systemctl restart sam
for i in $(seq 1 60); do systemctl is-active sam >/dev/null && break; sleep 2; done
[ -f "$L/after-sam.sh" ] && sh "$L/after-sam.sh" </dev/null
sleep 5
# the old web renderer for Home would keep showing the launcher; retry until the stock flutter Home is up
for t in 1 2 3 4; do
  pkill -f "[a]pp-id=com.webos.app.home"
  sleep 3
  luna_send -n 1 -w 10000 -f luna://com.webos.applicationManager/launch '{"id":"com.webos.app.home"}' >/dev/null
  sleep 8
  pgrep -f "[f]lutter-client -i com.webos.app.home" >/dev/null && ! pgrep -f "[a]pp-id=com.webos.app.home" >/dev/null && break
done
echo "stock Home restored; rm $L/DISABLE to re-enable at next boot"
