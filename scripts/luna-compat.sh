#!/bin/sh
# Closed stdin is the default. Opt in only where EOF makes luna-send exit early.
# An immediately unlinked private FIFO holds stdin without a feeder process.
_cytv_luna_fd=
luna_send() {
    if [ "${CYTV_LUNA_STDIN:-closed}" = open ]; then
        if [ -z "$_cytv_luna_fd" ]; then
            _cytv_luna_tmp=$(umask 077; mktemp -d "${TMPDIR:-/tmp}/cytv-luna.XXXXXX") || return 1
            mkfifo "$_cytv_luna_tmp/stdin" || { rmdir "$_cytv_luna_tmp"; return 1; }
            exec 3<> "$_cytv_luna_tmp/stdin" || { rm -f "$_cytv_luna_tmp/stdin"; rmdir "$_cytv_luna_tmp"; return 1; }
            rm -f "$_cytv_luna_tmp/stdin"
            rmdir "$_cytv_luna_tmp"
            _cytv_luna_fd=1
        fi
        command luna-send "$@" <&3
    else
        command luna-send "$@" </dev/null
    fi
}
