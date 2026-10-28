#!/bin/sh
# Replaces only the existing TVModding hook, never installs the upstream hooks.
[ -e /var/lib/tvmodding/DISABLED ] && exit 0
(
    D=/var/lib/tvmodding/cleanyourtv
    if [ -e "$D/ENABLED" ]; then
        cp "$D/app/index.html" /var/lib/tvmodding/home/index.html
        nohup /bin/sh "$D/start-helper.sh" </dev/null >/tmp/cleanyourtv-helper.log 2>&1 &
        # Home can paint its cached layout while the helper starts. Neither
        # helper readiness nor LG's late preload daemon should delay first paint.
        /usr/bin/python3 /var/lib/tvmodding/runtime.py boot &
        controller=$!
        ready=0
        for i in $(seq 1 45); do
            if curl -fsS -m 2 http://127.0.0.1:8765/api/service >/dev/null 2>&1; then ready=1; break; fi
            sleep 1
        done
        echo "$(cut -d' ' -f1 /proc/uptime) helper-ready=$ready"
        wait "$controller"
        if [ "$ready" != 1 ]; then
            # Local independent minimal UI remains the fallback; no network needed.
            /usr/bin/python3 /var/lib/tvmodding/fork_control.py fallback
            echo 'Root helper unavailable: using saved minimal UI' >/tmp/cleanyourtv-fallback.log
        fi
    else
        /usr/bin/python3 /var/lib/tvmodding/runtime.py boot
    fi
) </dev/null >/tmp/tvmodding-boot.log 2>&1 &
exit 0
