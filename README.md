<p align="center"><img src="assets/icon.svg" width="128" alt="CleanYourTV icon"></p>

# CleanYourTV — LG 70UQ7070ZUD (webOS 7.6.0)

**A model-specific fork for our rooted LG 70UQ7070ZUD, firmware 04.60.90,
webOS SDK 7.6.0 (webOS 22).** Based on
[lasharor/cleanyourtv-WebOS](https://github.com/lasharor/cleanyourtv-WebOS), with
the upstream launcher UI and native Home stand-in. This is not a claim that this
deployment is tested on other LG models or firmware versions.

| This fork's target | Recorded version |
| --- | --- |
| TV | **LG 70UQ7070ZUD** |
| Firmware | **04.60.90** |
| webOS / SDK | **7.6.0** (webOS 22 family) |
| TV Node.js | **12.21.0** |
| Homebrew Channel | **0.7.3** |
| CleanYourTV helper / launcher | **1.6.9 / 1.5.4** |
| Root method | **SlopBro**, official `throwaway96/slopbro` |
| Integration branch | [`tv/upstream-native`](https://github.com/TylerBuza/cleanyourtv-lg70uq7070-webos76/tree/tv/upstream-native) |

## Why upstream needed changes on this TV

The compatibility work here is for **LG 70UQ7070ZUD / firmware 04.60.90 /
webOS SDK 7.6.0**, using upstream **CleanYourTV 1.6.9 / launcher 1.5.4** as the
baseline. Having root was not enough to make that deployment reliable on this
firmware. We kept upstream's native Home stand-in and addressed these specific
problems rather than replacing it with another Home controller:

- **Luna commands could exit early.** On this firmware, `luna-send` could exit
  without executing or returning a reply when stdin reached EOF. That affected
  helper launch/status requests and shell-script Luna calls. This fork adds
  opt-in `CYTV_LUNA_STDIN=open` handling to both paths, while keeping one-shot
  calls bounded. The default for other TVs remains unchanged.
- **Reboot startup stayed on HDMI 2, then fell back to LG Home.** The boot hook
  saw the last HDMI input during its initial foreground check, so upstream's
  input-preserving logic skipped launching Home. No web launcher appeared and
  the safety fallback restored stock LG Home. This deployment uses the explicit
  `CYTV_BOOT_HOME=1` option to open Home after takeover. It does not keep pulling
  the user out of apps or HDMI afterward.
- **The default runtime location was unsafe for root-executed code here.**
  `/media/developer` was observed becoming recursively world-writable at boot.
  Even if a live install worked, leaving root startup scripts there was not
  acceptable. Generic runtime-path support and a quoted native wrapper let this
  deployment use protected `/var/lib/cleanyourtv` instead.
- **Icons could stay missing after helper startup.** Home could paint cached
  tiles before the helper was ready; failed images became text fallbacks that
  remained even after the helper recovered. Bounded icon retries now recover
  those cached tiles without a manual page reload.
- **Native undo needed safer ordering.** The isolated trial hit a busy mount
  when unmounting before stopping its interpreter; upstream's undo used that
  same ordering. This fork validates ownership, stops only the owned process
  tree with PID-start checks, then unmounts. A failed unmount is reported instead
  of being mistaken for a completed restore.

These are observed compatibility and safety findings for this target, **not** a
claim that upstream cannot work on other TVs or that the complete generic
installer/updater/uninstaller was tested here. Managed-mode guards separately
preserve this owner's existing debloat and optional-feature choices; they are a
deployment policy, not evidence of an upstream bug. See the
[native integration guide](docs/native-home.md) for details and validation limits.

## How we obtained root

We used the official [SlopBro](https://github.com/throwaway96/slopbro) tool at
revision [`21023d56ca424607bb03d2939609cc658c655fc7`](https://github.com/throwaway96/slopbro/tree/21023d56ca424607bb03d2939609cc658c655fc7),
running its Python 3 script from a Windows PC on the same LAN. We selected webOS
major version **7**, supplied the PC's local address explicitly, accepted the
TV's pairing prompt and used SlopBro's autoroot/Homebrew Channel workflow.
Afterward we verified **UID 0**, Homebrew Channel and key-based root SSH across
a restart; unauthenticated Telnet was disabled and confirmed closed.

See [the exact recorded procedure and precautions](docs/native-home.md#how-this-tv-was-rooted).
No firmware downgrade or cross-model firmware flash was used. This launcher
fork does **not** provide root or bundle the exploit. Do not reroot an already
rooted TV; another firmware may be patched. Check SlopBro's official instructions
and [current rooting compatibility](https://canirootmy.tv/) first. Keep pairing
files, SSH keys and recovery backups private.

## What is different in this fork

- Upstream's **native Home stand-in**, with generic compatibility options rather
  than a model-specific Python Home startup controller.
- Protected runtime at `/var/lib/cleanyourtv`, opt-in open Luna stdin, safe native
  undo ordering and bounded recovery of cached icons after helper startup.
- Existing approved debloat is separate. Managed mode guards automatic updates,
  uninstall and optional-feature changes. Voice, network notifications, Input-key
  injection and Live TV are **not enabled** on this TV.
- Root access and recovery are retained. Quick Start and Home Auto Launch remain
  **on**. Native integration is for upstream alignment, not a promised speed gain.

> [!WARNING]
> **Device-specific integration, not a universal installer.** Live native switching,
> launcher actions, full rollback/resume and the permanent software-reboot test
> passed. Home opened with icons without a manual reload. Do not treat this
> branch as an unattended installer or run the
> generic upstream install/update/uninstall commands over the managed TV.
> Actual playback/audio, connected HDMI/CEC, unplugged cold boot and prolonged
> standby are separate physical checks.

Start with [this TV's native Home, root and recovery guide](docs/native-home.md).
The fork is named `cleanyourtv-lg70uq7070-webos76`; the original directory
integration is retained on `tv/lg70uq7070-webos76`. No fork release or automatic update feed is
published. Any upstream contribution needs a focused review against `dev`.

Validation: **469 checks in 26 files** passed under both Node 8.12.0 and
22.20.0, along with page consistency, types, lint, formatting, package construction
and the documentation build. Optional Chromium 68/79 rendering checks could not
run in the local WSL environment because `libnss3.so` is missing; they are not
claimed as passed. See the [validation details](docs/native-home.md#validation-and-contribution).

---

## Upstream project documentation (reference)

The sections below describe **upstream's general features and installation**,
not the tested feature set or maintenance procedure for this managed TV. Links
to `lasharor.github.io` intentionally refer to the original upstream docs.

A fast home screen for rooted LG webOS TVs, with Live TV from your own playlist, an Inputs list on the Input key,
picture notifications, optional on-device voice recognition and an optional debloat of LG's ads and telemetry.

> [!NOTE]
> **LG's system files are not modified.** The launcher takes over Home with a mount that exists only in RAM, so a reboot without the
> boot scripts brings LG's Home back. Everything we install is stored in `/media/developer/cleanyourtv` (plus two boot scripts and
> the key binds), and the uninstall removes it. It runs on the TV: no server and no account of ours, and the project collects no
> data. Optional features contact the services you choose; [Security](https://lasharor.github.io/cleanyourtv-WebOS/security/) lists them.

**CleanYourTV** replaces LG's Home with a launcher: a dock of four apps, a top shelf, an app grid sorted by use, an Inputs
picker, a Settings shortcut and a clock. A small service runs on the TV as root and adds the rest. A manager app on the TV
sets up, updates and removes everything.

<p align="center"><img src="docs/screenshots/menu.gif" alt="The home screen, app options, Customise and Inputs menus" width="800"></p>

### Compatibility at a glance

* **webOS**: 5 and newer (2020 models and later). webOS 4 and older have no systemd and an old Node.js; the setup stops before it
  changes anything. LG names its versions two ways: [webOS version numbers](https://lasharor.github.io/cleanyourtv-WebOS/tested-tvs/#webos-version-numbers) gives both.
* **Access**: a TV rooted with the [Homebrew Channel](https://webosbrew.org) ([rootmy.tv](https://rootmy.tv)) and internet access
  on the TV for the download. Install from the Homebrew Channel, or with one command over SSH as `root`.
* **Tested hardware**: LG OLED65G26LA on webOS 25. Other TVs are reported in
  [Tested TVs](https://lasharor.github.io/cleanyourtv-WebOS/tested-tvs/); an unlisted firmware is set up when LG's Home is of the
  flutter or web kind, and otherwise the setup stops and offers **Set up anyway**.

**[Read the documentation](https://lasharor.github.io/cleanyourtv-WebOS/)** for the features, installation, updates and security.

---

## Quick start

1. Root the TV and install the [Homebrew Channel](https://webosbrew.org).
2. Install the manager app, one of two ways:
   - **From the Homebrew Channel.** Open the Homebrew Channel, the gear at the top, **Add repository**, and enter

     ```text
     https://github.com/lasharor/cleanyourtv-WebOS/releases/latest/download/apps.json
     ```

     **CleanYourTV** then shows in the channel's list: open it and choose **Install**. New releases show there as updates.
   - **From your computer**, with your TV's IP address:

     ```sh
     ssh root@192.168.1.50 'curl -fsSL https://raw.githubusercontent.com/lasharor/cleanyourtv-WebOS/main/install.sh | sh'
     ```

3. On the TV, open **CleanYourTV**, choose the options and **Set up now**. It takes about a minute and the screen blinks once.

That's it. The launcher is LG's Home from then on. If the new Home does not come up, the setup removes the boot scripts and
restarts the TV with LG's Home. The [installation guide](https://lasharor.github.io/cleanyourtv-WebOS/install/) has the details
and troubleshooting.

---

## What it's for

1. **[A launcher that is quick and yours](https://lasharor.github.io/cleanyourtv-WebOS/launcher/).** A dock of four apps, an app
   grid sorted by how often you use each app, top buttons you choose, an Inputs list and a clock; menus in English, Dutch, German,
   French and Spanish; [themes](https://lasharor.github.io/cleanyourtv-WebOS/themes/) for colours, layout and wallpaper, and
   [Wallpapers](https://lasharor.github.io/cleanyourtv-WebOS/wallpapers/): your own photos behind Home, uploaded from a phone or synced
   from Immich albums.

2. **[Live TV from your own playlist](https://lasharor.github.io/cleanyourtv-WebOS/live-tv/).** Plays an M3U playlist (HLS) with a
   channel list, a programme guide (XMLTV) and number entry. It does not use LG's tuner, and the project provides no channels.

3. **[An Inputs list on the Input key](https://lasharor.github.io/cleanyourtv-WebOS/input-key/).** The remote's Input button opens
   the dock apps, the HDMI inputs (with what is connected) and Live TV over the running app.

4. **[Picture notifications](https://lasharor.github.io/cleanyourtv-WebOS/notifications/).** A card with a photo over whatever is on
   screen, sent from your network with a POST request, for example from Home Assistant.

5. **[Voice, on the TV](https://lasharor.github.io/cleanyourtv-WebOS/voice/) (optional).** Speech recognition from the remote's
   microphone with a local model (Moonshine), answers from Home Assistant's Assist, a language model through OpenRouter or your own server, shown as
   text. No audio is recorded or sent anywhere.

6. **[Removing LG's ads and telemetry](https://lasharor.github.io/cleanyourtv-WebOS/debloat/) (optional).** Stops LG's ad and
   telemetry services and blocks a few ad servers, only while the launcher is Home, and undoes cleanly.

7. **[Setting up, updating and removing it from the TV](https://lasharor.github.io/cleanyourtv-WebOS/manager/).** The manager app
   checks every download against a SHA-256 file, rolls back a launcher or service that does not start, and can follow a
   [dev build](https://lasharor.github.io/cleanyourtv-WebOS/managing/#dev-builds) to get changes before the daily release.

---

## Themes

Pick how Home looks in the manager app: colours, the position and size of the clock, buttons, dock and grid, a wallpaper, animation
speed. The themes are in [`themes/`](themes/) of this repository: the TV reads them from GitHub and downloads one when you choose it,
so a new theme needs a pull request and no release ([how](https://lasharor.github.io/cleanyourtv-WebOS/themes/#contributing-a-theme)).

<p align="center"><a href="themes/"><img src="docs/screenshots/themes-readme.jpg" alt="Classic, Midnight, Pixel and Bloom themes" width="800"></a></p>

---

## Screenshots

<p align="center">
  <a href="docs/screenshots/live.jpg"><img src="docs/screenshots/live.jpg" alt="Live TV guide" width="440"></a>
  &nbsp;
  <a href="docs/screenshots/picker.jpg"><img src="docs/screenshots/picker.jpg" alt="Inputs picker on the Input key" width="440"></a>
  <br>
  <a href="docs/screenshots/grid.jpg"><img src="docs/screenshots/grid.jpg" alt="App grid" width="440"></a>
  &nbsp;
  <a href="docs/screenshots/manager.jpg"><img src="docs/screenshots/manager.jpg" alt="Manager app" width="440"></a>
  <br>
  <sub>Live TV guide, the Inputs picker, the app grid and the manager app.</sub>
</p>

[More screenshots](https://lasharor.github.io/cleanyourtv-WebOS/#screenshots).

---

## Documentation

* [Installing](https://lasharor.github.io/cleanyourtv-WebOS/install/) and [tested TVs](https://lasharor.github.io/cleanyourtv-WebOS/tested-tvs/)
* [Updating and uninstalling](https://lasharor.github.io/cleanyourtv-WebOS/managing/), including dev builds
* Using it: [the launcher](https://lasharor.github.io/cleanyourtv-WebOS/launcher/), [Live TV](https://lasharor.github.io/cleanyourtv-WebOS/live-tv/),
  [the Input key](https://lasharor.github.io/cleanyourtv-WebOS/input-key/), [picture notifications](https://lasharor.github.io/cleanyourtv-WebOS/notifications/),
  [voice](https://lasharor.github.io/cleanyourtv-WebOS/voice/), [debloat](https://lasharor.github.io/cleanyourtv-WebOS/debloat/) and
  [the manager app](https://lasharor.github.io/cleanyourtv-WebOS/manager/)
* [Security](https://lasharor.github.io/cleanyourtv-WebOS/security/)
* [What it changes on the TV](https://lasharor.github.io/cleanyourtv-WebOS/tv-changes/)
* [Service API](https://lasharor.github.io/cleanyourtv-WebOS/api/) and [troubleshooting](https://lasharor.github.io/cleanyourtv-WebOS/troubleshooting/)
* [Contributing](https://lasharor.github.io/cleanyourtv-WebOS/development/), [testing and CI](https://lasharor.github.io/cleanyourtv-WebOS/development/testing/)
  and [internals](https://lasharor.github.io/cleanyourtv-WebOS/development/internals/)

The pages are built with [Zensical](https://zensical.org) from [docs/](docs/), so they can also be read there.

---

## Security

The service runs as root on the TV and listens on `127.0.0.1:8765` only. A few short-lived pages open on the local network on
request (Live TV pairing, share log, voice setup) and the notification endpoint is off until you switch it on. Everything it
installs comes from this repository's GitHub releases and carries a SHA-256 file, which detects corruption but **not a compromised
repository**: download only from this repository's release page. [Security](https://lasharor.github.io/cleanyourtv-WebOS/security/)
covers the ports, the token for notifications, voice and dev builds. To report a vulnerability, see [SECURITY.md](SECURITY.md).

---

## Contributing

Troubleshooting and fixing with an AI assistant (Claude, ChatGPT, a local model) is supported: [`AGENTS.md`](AGENTS.md) is the briefing,
[`tools/diagnose.sh`](tools/diagnose.sh) collects a read-only report from the TV, and the
[documentation](https://lasharor.github.io/cleanyourtv-WebOS/ai/) has the prompts and the rules.

Reports from other TVs are the most useful contribution: open an [issue](https://github.com/lasharor/cleanyourtv-WebOS/issues)
with the output of **Share log** in the manager app. For code, see [Contributing](https://lasharor.github.io/cleanyourtv-WebOS/development/):
the service runs on Node.js 8 (webOS 5), `sh tools/check.sh` runs every check, every push to `dev` publishes a dev build, and a release goes out daily from `dev`.

---

## Disclaimer

CleanYourTV is an independent project. It is not affiliated with, endorsed by or supported by LG Electronics. LG and webOS are
trademarks of LG Electronics. This modifies a running TV with root access; read `install.sh` and `scripts/` before running them,
and use it at your own risk. Live TV plays only the playlists you add.

## Licence

MIT. See `LICENSE`. The package also contains third-party files, listed with their licences in
[`THIRD-PARTY.md`](THIRD-PARTY.md) and in [Credits and licences](https://lasharor.github.io/cleanyourtv-WebOS/credits/). The home-screen
design follows the Android TV project [CleanYourTV](https://github.com/Gathin23/cleanyourtv) (MIT); no code from it is used.
