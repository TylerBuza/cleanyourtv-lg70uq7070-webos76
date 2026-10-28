#!/bin/sh
# Protected state avoids webOS's recursive chmod 777 of /media/developer at boot.
set -eu
export CYTV_DIR=/var/lib/tvmodding/cleanyourtv
export CYTV_PLATFORM=tvmodding
export CYTV_LUNA_STDIN=open
export PATH=/usr/bin:/usr/sbin:/bin:/sbin
cd "$CYTV_DIR"
exec /usr/bin/node "$CYTV_DIR/helper.js"
