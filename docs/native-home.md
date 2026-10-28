# Native Home port: upstream lifecycle, protected runtime

This branch uses upstream's **native executable stand-in**, not the older
TVModding directory/rescan controller, for Home. The page and helper remain
CleanYourTV 1.6.9 / frontend 1.5.4. Changes are split into reusable compatibility,
native lifecycle and icon-recovery fixes; upstream's defaults remain available.

## Tested target and root

The target is LG 70UQ7070ZUD, firmware 04.60.90, webOS SDK 7.6.0, Node 12.21.0,
Homebrew Channel 0.7.3. Root was obtained with the official
[throwaway96/slopbro](https://github.com/throwaway96/slopbro) at
[`21023d56ca424607bb03d2939609cc658c655fc7`](https://github.com/throwaway96/slopbro/tree/21023d56ca424607bb03d2939609cc658c655fc7).
Consult that revision's own instructions and [current compatibility](https://canirootmy.tv/)
before another device/firmware. No exploit source is copied into this MIT fork.
Do not reroot an already-rooted TV, enable LG Developer Mode or flash another
model's firmware. Updates can remove root; this port does not change the owner's
firmware-update preference. Root SSH uses private keys and pinned host keys;
unauthenticated Telnet remains disabled.

### How this TV was rooted

This records what was done to **this owned TV**, not a reason to rerun the
exploit on an already-rooted set or bypass another firmware's compatibility.

1. Obtained the official SlopBro source at the revision linked above, without
   copying its exploit source into this MIT launcher fork.
2. Ran `slopbro.py` with **Python 3 on Windows**, on the same LAN as the TV,
   selecting webOS major **7** and explicitly selecting the PC's LAN address.
   The recorded command shape, with private addresses replaced, was:

   ```powershell
   py -3 -u .\slopbro.py --debug --webos-version 7 --local-ip <PC_LAN_IP> <TV_LAN_IP>
   ```

   The bracketed values are placeholders, not commands to paste unchanged.
3. Accepted the pairing prompt on the TV and used the tool's supplied
   autoroot/Homebrew Channel workflow. Follow that revision's official README
   for prerequisites and on-screen progress, rather than an unrelated rooting
   guide or instructions for a different model.
4. Verified that root commands reported **UID 0**, Homebrew Channel **0.7.3** was
   installed, and key-based root SSH survived a restart. A successful HTTP/file
   transfer alone was **not** treated as proof of root.
5. Pinned the SSH host key, retained private recovery backups and disabled
   unauthenticated Telnet; its port was confirmed closed after restarting.

No firmware downgrade, cross-model flash or custom rewrite of signed
root-persistence files was used. SlopBro's own rooting/persistence workflow is
separate from this launcher's RAM-only Home replacement. Do not install LG
Developer Mode on this already-rooted TV. Firmware updates may remove root;
this fork does not change the owner's firmware-update preference.

Pairing `.key` files, SSH private keys, raw exploit logs, device identifiers and
recovery archives are deliberately excluded from the public fork. SlopBro's
licence remains with its original project; describing our use does not relicense
or redistribute its source.

## What starts Home now

1. Homebrew runs `10-cleanyourtv-home`, linked to the protected runtime.
2. The upstream script stages the HTML page and a web description derived from
   the backed-up native Home manifest.
3. It temporarily bind-mounts a small wrapper over LG's native program. The
   wrapper execs `home-standin.sh` from its actual runtime folder.
4. The stand-in asks WebAppMgr to display the HTML and registers for Home
   relaunch events. SAM keeps the original **native** Home registration.

No Python Home startup, foreground watcher, `general.defaultApps`,
`systemprofile` API or SAM restart is needed in native-only mode. Original
firmware files are not overwritten. The wrapper adds no resident feeder process;
the stand-in and its registration pipeline remain running as upstream designed.

The existing TV's approved debloat is a **separate** maintenance hook, not a
prerequisite for Home. Its legacy `HOME-ENABLED` flag is removed so that the
old directory controller cannot take Home back at boot. No app removals,
tracking settings or firmware-update choices are added by the migration.

## Why these compatibility changes exist

- **Protected runtime directory:** runtime shell scripts follow `CYTV_DIR` or
  their installed path, including a boot-hook symlink. On this firmware,
  `/media/developer` was observed becoming recursively world-writable at boot.
  This port stores executable code under `/var/lib/cleanyourtv` instead. Code
  and parents must be root-owned and not group/world-writable; secrets remain
  root-only. The web overlay alone is readable by the non-root web engine.
- **Persistent runtime options:** `runtime-env.sh` contains quoted non-secret
  options. It is root-owned code, not a place for credentials.
- **Luna stdin:** `CYTV_LUNA_STDIN=open` keeps stdin open for both Node and shell
  calls. The shell uses an immediately unlinked private FIFO, with no persistent
  FIFO name or feeder process. Other TVs retain closed stdin by default. Luna wait
  limits and Node's bounded child-process handling remain in place.
- **Native-only safety:** `CYTV_NATIVE_ONLY=1` refuses the directory/SAM-restart
  fallback. On cold takeover, original manifest and native-program checksum
  must match the saved baseline; changed firmware requires review.
- **Safe undo:** verify the mounted program belongs to this runtime, stop only
  its script/registration descendants with PID-start-time checks, then unmount.
  A busy/foreign mount keeps its recovery marker and reports failure instead
  of falsely claiming that stock Home was restored.
- **Watchdog retirement:** generation tokens prevent a disabled/replaced Home
  instance's watchdog from surviving quick off/on lifecycle changes.
- **Cold-start icons:** cached text fallback tiles retry their icons after a
  successful helper app-list request, even if the layout is unchanged. Retries
  are bounded; missing icons cannot create an endless request loop.
- **Explicit startup Home:** `CYTV_BOOT_HOME=1` requests Home after native
  takeover even if this firmware still reports the last HDMI input during its
  boot hook. Without it, upstream's input-preserving behaviour remains: only
  empty/Home foreground triggers an initial launch. This is an opt-in startup
  choice, not a watcher pulling the user out of apps or HDMI afterward.

## Runtime options

| Option | Purpose |
| --- | --- |
| `CYTV_DIR` | Actual runtime folder; default installer location remains `/media/developer/cleanyourtv` |
| `CYTV_LUNA_STDIN=open` | Opt-in EOF workaround; default is closed stdin |
| `CYTV_NATIVE_ONLY=1` | Native stand-in lifecycle only; no SAM-restart fallback |
| `CYTV_MANAGED=1` | External maintenance owns updates and optional module/lifecycle settings |
| `CYTV_EXTERNAL_DEBLOAT=1` | Do not apply or undo another controller's cleanup |
| `CYTV_BOOT_HOME=1` | Explicitly open Home after native startup, including over the last HDMI input; default off |

Managed mode leaves voice, network notifications and Input-key injection
unloaded and blocks installer/update/channel/uninstall/key-learning/cleanup
changes through the helper. Home controls use the upstream native lifecycle
scripts, not an external Python Home controller. Normal UI customisation,
app launching, themes and wallpapers remain available. Live TV remains off on
this target; no playlists, accounts or network addresses are shipped.

The generic installer refuses an existing protected `MANAGED` runtime, rather
than installing another owner over it. Do not run the ordinary README's quick
install/uninstall commands over this TV's managed installation.

For developers investigating a **fresh** native port, the bootstrap supports
these environment options, with `--no-input-key --no-debloat --force`. Native
Home still needs explicit acceptance; `--force` does not bypass native-only
manifest/program requirements. The custom-directory bootstrap is fixture-tested
offline. That is not a claim that the complete generic installer/updater was
device-tested on an already-managed TV. Review its setup, ownership and recovery
before using it on another device.

## Daily use and recovery

Quick Start and Home Auto Launch remain **on**. Turning Auto Launch off left
normal wake on HDMI 2 until Home was pressed; it is not a blanket speed fix.
The native mechanism passed isolated app/Home, renderer-recovery, software-reboot
and owner-confirmed physical remote wake tests on this exact target. Actual
playback/audio, connected HDMI/CEC and unplugged cold boot are separate checks.
The permanent protected runtime subsequently passed full rollback/resume, native
Home off/on, real launcher tile actions, Stremio/YouTube/HDMI 2-to-Home and a
real software reboot. Home opened automatically with icons and no manual page
reload. Root SSH, closed Telnet, cleanup, protected-code hashes/permissions and
configuration survived. Physical remote wake confirmation from the isolated
trial is not being represented as acceptance of this exact permanent payload.

The first permanent boot exposed a startup-selection difference: the hook saw
HDMI 2, so upstream's conditional launch skipped Home and its safety fallback
returned to stock LG Home. This deployment explicitly uses `CYTV_BOOT_HOME=1`
to choose Home after takeover; the default remains input-preserving. The
successful repeat boot is not a matched speed comparison with the isolated trial.
It showed no meaningful speed advantage over directory takeover in that trial:
the late Homebrew hook dominated full reboot time. Do not call this a native-
rendered launcher: both implementations display the same HTML through WebAppMgr.

Native-only Home controls in the installed protected runtime are:

```sh
sh /var/lib/cleanyourtv/native-home.sh disable  # Stock LG Home; keep external cleanup
sh /var/lib/cleanyourtv/native-home.sh enable   # Re-enable the upstream stand-in
```

The private migration tool additionally backs up the former runtime/hook/flags,
verifies transfer hashes and can restore the whole prior directory setup. It is
not the Home startup engine and is not required by a fresh native installation.
Keep independent root SSH and verified recovery archives available before any
change. Homebrew failsafe skips its boot hooks. No signed root-persistence entry
or firmware partition is edited.

## Validation and contribution

Run `sh tools/check.sh` (Node 8.12 and current Node, page consistency,
types/lint/formatting) and `python3 ipk/build.py`. New regressions cover Node and
shell stdin, protected runtime paths, quoted wrapper arguments, metadata drift,
foreign mounts, recycled PIDs, managed lifecycle guards and cached icon recovery.
Tests do not establish hardware or playback compatibility by themselves.

The current branch passed **469 checks in 26 files** on both Node 8.12.0 and
22.20.0, page consistency, types, lint, formatting, package construction and a
Zensical 0.0.71 documentation build. Eleven private migration safety checks also
passed. Optional Chromium 68/79 rendering checks were attempted, but the local
WSL browser executables could not start because `libnss3.so` is missing. Their
archives were checksum-verified; no old-browser rendering pass is claimed.

No fork release, tag, install feed or automatic update channel is published.
Upstream contributions target **`dev`**, not `main`; runtime compatibility and
icon recovery can be proposed independently of this owner's deployment policy.
MIT attribution and `THIRD-PARTY.md` are preserved. OpenCode with OpenAI GPT-6.1
Sol assisted the code, tests and documentation. Private keys, pairing data,
backups, usage, raw device reports, serials and LAN addresses stay outside Git.
