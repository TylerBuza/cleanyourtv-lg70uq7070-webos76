# Troubleshooting

- **Black screen after switching or rebooting.** Wait a minute; if it stays black, restart the TV. If the new Home does not come
  up, the setup removes the boot scripts and restarts the TV with LG's Home by itself.
- **The Home button opens LG's full-screen Home, not CleanYourTV.** Some TVs have a Home Style setting. Set TV Settings > General >
  Home Settings > Home Style to Basic.
- **Apps do not open, an HDMI input has no picture or the remote no longer controls HDMI-CEC devices (webOS 5 to 23).** These
  followed the restart of the app manager on TVs with LG's native Home (issues 14, 23 and 24). From service 1.6.6 such a TV takes
  over Home without that restart. **Share log** shows the steps under _Boot steps_; open an issue with it if the problem stays.
- **An app is missing from the grid.** Check **Hidden apps** in Customise. Apps without a launch icon are not listed.
- **After a firmware update removed root.** Re-root, then run the [install command](install.md#1-install-the-manager-app) and the setup again.
- **The Input key opens LG's picker.** Check the Input key switch in the manager app and run **Learn the Input key**.
- **A loading circle appears every half minute and the remote stops responding until you hold Back.** The Input key can show the
  Inputs list over the running app with a small app that the service starts in the background. On webOS 6.5 (reports) the TV closes that
  app again and it keeps the remote. From v1.5.13 webOS before 10 starts the app only when the key is pressed and closes it after use,
  and on any TV the service switches to that when it had to start the background app three times in ten minutes
  (`picker.mode: ondemand` in `config.json`). **Input key** > **Input key shows** chooses by hand; switching the Input key off entirely
  gives the key back to LG.
- **The manager list does not show Share log or Uninstall.** Before v1.5.13 the list could not scroll; update, then move down: the
  list scrolls and fades where more rows are hidden.
- **Text appears twice in menus or the Live TV list on webOS 5 (blurred, overlapping).** webOS 5's browser (Chromium 68) can keep the old
  text when a list is redrawn. From v1.5.13 the launcher swaps the list for a fresh element there instead of rewriting it.
- **The service restarts by itself.** On some TVs Node.js 8 stops with `uv_close: Assertion ... failed`. From v1.5.13 the service
  logs its last operations when it finds that the previous run ended without a clean exit; they appear in **Share log** under the
  service log, so a report names the cause.
- **`FAILED_IPKG_INSTALL`.** Remove the `com.cleanyourtv.manager` entry marked `half-installed` from
  `/media/developer/apps/var/lib/opkg/status` and install again.
- **Live TV shows the setup code again.** The playlist address was reset or never saved; run the pairing again, or send it with
  `POST /api/live/settings` ([Live TV](live-tv.md#setting-it-up)).
- **Something is broken after an update.** A launcher or service that does not start is replaced by the previous version
  automatically. **Go back to launcher** in the manager returns to the previous launcher by hand.
- **Back to LG's Home right now.** In the manager, **CleanYourTV as Home** off, or `sh /media/developer/cleanyourtv/undo-home.sh`
  over SSH.

## Luna replies disappear on webOS 7.6.0

On one LG 70UQ7070ZUD running firmware 04.60.90 (webOS 7.6.0, Node 12.21.0),
`luna-send` could exit without executing or returning a reply when stdin reached
EOF. Set `CYTV_LUNA_STDIN=open` in the launch environment to opt in to keeping
stdin open. The Node helper holds its input pipe until the child exits and
preserves both the Luna wait and process kill deadline. The shell scripts use
`luna-compat.sh`: an immediately unlinked private FIFO holds a descriptor open
without a feeder process or persistent FIFO name. One-shot shell calls retain
their Luna wait arguments; the native Home registration remains a subscription.
Unset the variable to restore the default closed-stdin behaviour on other TVs.

Developers can also pass `keepStdinOpen: true` to `helper/luna.js`; an explicit
`false` overrides the environment. The foreground-app probe follows the same
environment variable. Export the option in the environment that starts the
service and scripts on each boot; this change does not persist installation
preferences or change the default boot configuration. It does not make an
unsupported Home takeover or installer safe. Equivalent Node and shell handling
was checked in a separately managed native deployment; the complete generic
installer/updater/uninstaller and other firmware were not device-validated.

## Reporting a problem

An AI assistant can help you read the report and find the cause: see [Working on problems with an AI assistant](ai.md).

Open an [issue](https://github.com/lasharor/cleanyourtv-WebOS/issues) and attach the output of **Share log**
(manager app, see [The manager app](manager.md#share-log)). It is masked, so it does not contain your addresses or keys. Say which
TV and firmware you have and what you expected.
