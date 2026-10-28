# TVModding fork: LG 70UQ7070ZUD / webOS 7.6.0

This branch adapts upstream **CleanYourTV 1.6.9 (launcher 1.5.4)** at
`5fe1715915a5c83d6c371b23b44ae5c8217e2cd7` to an existing rooted-TV maintenance
setup. It is a single-TV integration, not a universal compatibility claim.

**Not a standalone installer.** The launcher/helper adaptations and boot-hook
source are here; the separately developed Home/debloat controller, PC deployment
tools, standalone fallback, device backups and recovery receipts are not. Those
are required dependencies, not something the generic installer creates. Do not
copy the boot hook onto a fresh TV or run the generic installer to reproduce
this setup. A successful package build does not change that limitation.

## Tested environment and root method

| Component        | Tested value                |
| ---------------- | --------------------------- |
| Model            | LG 70UQ7070ZUD              |
| Firmware         | 04.60.90                    |
| webOS SDK        | 7.6.0                       |
| TV Node.js       | 12.21.0                     |
| Homebrew Channel | 0.7.3                       |
| Original Home    | Native `com.webos.app.home` |

Root was obtained using the official
[throwaway96/slopbro](https://github.com/throwaway96/slopbro) project, revision
[`21023d56ca424607bb03d2939609cc658c655fc7`](https://github.com/throwaway96/slopbro/tree/21023d56ca424607bb03d2939609cc658c655fc7).
SlopBro uses on-screen SSAP pairing and a local HTTP payload server, then the
jsserver exploit and its autoroot payload install Homebrew Channel and root
persistence. Refer to that revision's own README for prerequisites and usage;
its exploit code is **not** copied into this MIT project.

This is a record of the method that worked, not a recommendation to rerun the
exploit on an already-rooted TV. Check current compatibility at
[Can I Root My TV?](https://canirootmy.tv/) and read the root project's warnings
before attempting another device or firmware. Rooting can damage a TV, affect
warranty/support, and be removed by a firmware update. No firmware downgrade or
cross-model image was used.

After rooting, key-authenticated root SSH and Homebrew Channel survived software
restarts. SSH host keys are pinned in the private maintenance setup;
unauthenticated Telnet was disabled and verified closed. LG Developer Mode was
not enabled. This fork does not change the owner's firmware-update policy.
Keep credentials and recovery archives off GitHub, and never disable host-key
checking to bypass an unexpected key change.

## What differs from upstream

- Keep the existing `/var/lib/tvmodding/runtime.py` owner of Home takeover,
  reversible debloat, backups and recovery. It bind-mounts a web Home directory,
  asks SAM to rescan while preserving the regional blocklist, verifies Home is
  registered as **web**, and only then stops native LG Home. No foreground/Home
  watcher races LG's dashboard, and native Home is not left behind the page.
- Never restart SAM, install a native executable stand-in, or add upstream
  Home/debloat hooks on top of this controller. The generic bootstrap now refuses
  a detected TVModding controller, even with `--force`.
- Use upstream's richer page, dock, app grid, Customise, themes, wallpapers,
  Inputs and Settings. One root Node helper listens only on `127.0.0.1:8765`.
- Store root-executed code under `/var/lib/tvmodding/cleanyourtv`, not
  `/media/developer`: this firmware was observed recursively making that latter
  tree writable by other users during boot. Executable code is root-owned and
  not group/world-writable; configuration and tokens are root-only.
- Keep Luna stdin open in the helper's launch environment. EOF on this firmware
  can make `luna-send` exit without executing or returning a reply. Both Luna and
  child-process deadlines remain bounded; other TVs retain closed stdin by
  default. See [the compatibility note](troubleshooting.md#luna-replies-disappear-on-webos-760).
- Select the controller profile only for the exact tested model, firmware and
  SDK **and** an explicit `tvmodding` platform. Matching a model alone must not
  make the generic installer claim compatibility.
- Do not start voice, network notifications, Input-key injection or upstream
  debloat modules in this integration. Live TV starts disabled; no playlists or
  accounts are included. Those features need separate acceptance work.
- Refuse upstream self-updates, channel switching, key learning, cleanup changes
  and uninstall through the managed API. They must not bypass the existing
  controller or install an incompatible upstream bootstrap. Read-only upstream
  theme downloads remain available.

Profile rules and regression cases are in `helper/tvprofile.js` and
`tools/test/tvprofile.test.js`; lifecycle checks are in
`tools/test/tvmodding.test.js`. Opt-in Luna pipe handling has independent tests
in `tools/test/luna.test.js` and `tools/test/diag.test.js`.

## Startup: normal wake is not a full reboot

**Final daily-use settings:** Quick Start is on (`option.quickStartMode: "on"`),
and Home Auto Launch is on (`general.homeAutoLaunch: "on"`). After enabling
Auto Launch, the owner reported that normal remote off/on was really quick.
This is qualitative acceptance, not a timed standby benchmark. HDMI inputs
remain usable; none were disabled to force the launcher.

Auto Launch was initially turned off to avoid LG Home appearing before the root
hook on full boot. That left normal wake sitting on HDMI 2 until Home was
pressed. Re-enabling it fixed that daily-use behaviour. Do not recommend turning
it off as a blanket performance improvement. `general.powerOnScreen` remained
`"todays"`; Quick Start was already enabled and was not changed by this fork.

The integration replaces only the existing TVModding hook with
`tvmodding/boot.sh`. It starts the helper and controller in parallel so the
upstream page can paint its cached layout while the helper starts. The
controller shows Home **before** waiting for the late preload-manager/live-policy
phase and remaining cleanup. It records boot-relative milestones in
`/var/lib/tvmodding/boot-timing.json`.

One full software-reboot test changed the recorded Home-foreground milestone
from approximately **74 seconds to 46.05 seconds after boot**. The controller
began at 39.93 seconds, helper readiness was 47.08 seconds, and deferred policy
work finished at 66.83 seconds. These are single-device software observations,
not a frame-camera first-paint benchmark or a promise about other TVs. The fast
test still had Auto Launch off; no new full-reboot timing was collected after
turning it on. Unplugged cold boot was not measured.

Most remaining full-reboot delay precedes the Homebrew hook. No earlier root
service, signed startup-chain modification, firmware patch or boot-logo removal
was installed. An early Home press, cold start or failsafe path can still expose
stock Home before takeover. Fast normal wake does not eliminate full-boot delay.

## Recovery and existing cleanup

Before deployment, the private maintenance setup saved SHA256-verified root,
pre-cleanup and pre-fork archives. Returning to the standalone minimal page and
then resuming the fork was tested. Fast-start changes have separate originals
and deployed-file hashes.

For the **existing managed installation only**, the private PC tools provide:

```powershell
.\Fork-TV.ps1 status
.\Fork-TV.ps1 rollback         # Saved standalone UI/hook and original Auto Launch preference
.\Fork-TV.ps1 resume           # Re-enable the retained, verified fork
.\Fork-TV.ps1 undo-fast-start  # Pre-optimisation controller/hook for the next boot
```

Those wrappers are not distributed here. The existing controller's independent
route back to stock LG Home, over root SSH, is:

```sh
python3 /var/lib/tvmodding/runtime.py restore-home
```

To suppress the entire TVModding hook on the next boot, its existing kill switch
is `/var/lib/tvmodding/DISABLED`. Homebrew Channel failsafe also skips user boot
hooks. Keep working root SSH and private backups available before any changes;
neither this source branch nor an upstream uninstall is a substitute for them.
Review the saved Auto Launch preference after rollback/resume rather than
assuming it will preserve a later manually chosen setting.

Existing cleanup was preserved: nine approved removable stubs were uninstalled,
20 selected advertising/ACR/demo/assistant/Channels IDs were blocked and masked,
and `admanager`/`acr2` were stopped and bind-masked. Promotion/tracking settings
were read back. Other streaming/input preload policies, casting, HDMI/audio,
the app store and root access were retained. Uninstalled stubs are not restored
by lifting a bind mask; reinstall them through the store if needed.

This is **not** a claim that all tracking is blocked. Diagnostic services such
as `rdxd` and `uploadd` remain. No generic debloat or removal recipe is shipped
in this fork, and unrelated failed launcher-install recovery state was not
deleted or used as a prerequisite.

## Validation and contribution scope

On the real target: the richer UI, physical app launch/Home return, Customise,
software-restart persistence, root SSH, closed Telnet, protected file modes,
cleanup and the absence of the native Home process were verified. Normal remote
wake was accepted by the owner after restoring Home Auto Launch. Live TV,
voice, network notifications and Input-key remapping were not accepted or
enabled. No RAM-saving claim from the older minimal UI applies to this richer
page/helper.

Offline checks use Node 8.12.0 and Node 22.20.0, page-source consistency, types,
lint, formatting and package construction:

```sh
sh tools/check.sh
python3 ipk/build.py
```

Before publication, **444 checks in 22 files passed on each Node version**;
page consistency, types, lint, formatting and package construction also passed.
The final publication hardening (explicit platform gate, generic-installer
refusal and per-call stdin override) was tested offline, not redeployed to the
TV. Publishing does not change its already-working payload or settings.

No fork release, tag, install feed or update channel is published. The upstream
README's release URLs still refer to upstream. A reusable contribution should
target upstream **`dev`**, following its contribution rules, and keep the
opt-in Luna compatibility fix separate from the private controller integration.

MIT attribution and `THIRD-PARTY.md` are retained. Root-method links are
references only; no SlopBro/AGPL exploit source is bundled. OpenCode with OpenAI
GPT-6.1 Sol assisted the integration, tests and documentation. Private addresses,
SSH identities, pairing keys, serials, stream URLs, usage history and raw device
reports are deliberately excluded.
