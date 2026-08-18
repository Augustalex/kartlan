# 🏎️ KARTLAN 3D

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Release](https://img.shields.io/github/v/release/Augustalex/kartlan?color=ff0055)](https://github.com/Augustalex/kartlan/releases)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16.0.0-00f0ff.svg)](https://nodejs.org/)

> **A high-octane, arcade 3D kart racer built for instant, fault-free Wi-Fi LAN multiplayer with your friends.**

```
   ██╗  ██╗ █████╗ ██████╗ ████████╗██╗      █████╗ ███╗   ██╗    ██████╗ ██████╗ 
   ██║ ██╔╝██╔══██╗██╔══██╗╚══██╔══╝██║     ██╔══██╗████╗  ██║    ╚════██╗██╔══██╗
   █████═╝ ███████║██████╔╝   ██║   ██║     ███████║██╔██╗ ██║     █████╔╝██║  ██║
   ██╔═██╗ ██╔══██║██╔══██╗   ██║   ██║     ██╔══██║██║╚██╗██║     ╚═══██╗██║  ██║
   ██║ ╚██╗██║  ██║██║  ██║   ██║   ███████╗██║  ██║██║ ╚████║    ██████╔╝██████╔╝
   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝    ╚═════╝ ╚═════╝ 
```

---

## ⚡ Quickstart: Play or Update in 5 Seconds

### 🎮 For Your Friend (Single Command One-Liner):
Copy and paste this into any terminal (Linux / macOS / WSL) to **install, update to the latest version, and launch the game**:

```bash
curl -sSL https://raw.githubusercontent.com/Augustalex/kartlan/main/install.sh | bash
```

> 💡 **Already have it installed?** Running the same command will **automatically pull the latest version** and launch right away!

Or if already inside the folder:
```bash
./update.sh   # Updates to latest version
./play.sh     # Launches the game
```

---

## 📦 Debian / Ubuntu Installation (.deb)

Download the `.deb` release package from [GitHub Releases](https://github.com/Augustalex/kartlan/releases):

```bash
# 1. Download Debian package
wget https://github.com/Augustalex/kartlan/releases/download/v1.0.0/kartlan_1.0.0_all.deb

# 2. Install package
sudo dpkg -i kartlan_1.0.0_all.deb
sudo apt-get install -f   # Installs nodejs dependency if needed

# 3. Launch from terminal or Desktop Application menu!
kartlan
```

---

## 🌐 Playing Over Wi-Fi LAN

1. **Host starts the game**: Run `kartlan` or `npm start`.
2. The server detects your Wi-Fi IPv4 address (e.g. `http://192.168.1.150:3030`) and announces presence on the local network.
3. **Friends connect**:
   - **Method A (Direct Browser Link)**: Your friend opens any browser (Chrome, Firefox, Safari, Edge) on PC, Mac, Linux, iPad, or mobile and navigates directly to `http://<your-lan-ip>:3030`.
   - **Method B (One-Liner Runner)**: Your friend runs `curl -sSL https://raw.githubusercontent.com/Augustalex/kartlan/main/install.sh | bash`.
   - **Method C (LAN Auto-Discovery)**: In the game lobby, click **🔄 SCAN LAN** to auto-detect the host room.
4. Choose your kart colors, set ready, and start the Grand Prix!

---

## 🎮 Controls & Gamepad Support

Full support for Keyboard, USB/Bluetooth Gamepads (Xbox, PlayStation, Nintendo Switch Pro), and Mobile Touch screens:

| Action | Keyboard | Gamepad (Xbox / PS / Switch) | Touch / Mobile |
| :--- | :--- | :--- | :--- |
| **Accelerate** | `W` / `Up Arrow` | `Right Trigger (RT/R2)` / `A (✕)` | **GAS** Button |
| **Brake / Reverse** | `S` / `Down Arrow` | `Left Trigger (LT/L2)` / `B (○)` | **BRAKE** Button |
| **Steer** | `A` `D` / `Left` `Right` | `Left Analog Stick` / `D-Pad` | **◀ ▶** Buttons |
| **Hop & Drift** | `Space` / `Left Shift` | `Right Bumper (RB/R1)` / `X (□)` | **DRIFT** Button |
| **Use Item** | `E` / `Enter` / `F` | `Left Bumper (LB/L1)` / `Y (△)` | **ITEM** Button |
| **Look Back** | `C` | `Right Stick Click (R3)` | — |
| **Respawn / Reset** | `R` | `Select / Back` | — |

---

## 🏎️ Deep Arcade Kart Mechanics

- 💫 **Hop & 3-Tier Mini-Turbo Drift**:
  - Tap **Drift** to hop and lock into a slide.
  - Counter-steer into the apex to charge your mini-turbo sparks faster:
    - **Tier 1 (Cyan Sparks)**: +25% Speed Surge for 0.9s
    - **Tier 2 (Orange Sparks)**: +48% Speed Surge for 1.7s
    - **Tier 3 (Purple Sparks)**: +75% Speed Surge for 2.6s
  - Release **Drift** to unleash the rocket boost!
- 💨 **Drafting / Slipstream**: Follow directly behind an opponent kart for 1.4s to gain a high-speed draft boost.
- ⚡ **Jump Ramps & Stunts**: Hop off ramp crests to perform aerial stunt spins for landing speed bursts.
- 🛑 **Off-Road Physics**: Grass and sand reduce speed to 40% unless boosting with a Mushroom or Starman.
- 🛡️ **Items & Weapons**:
  - 🟢 **Green Shell**: Straight ricochet projectile (bounces off track barriers).
  - 🔴 **Red Shell**: Homing projectile following track waypoints toward the leader.
  - 🍌 **Banana**: Hazard trap dropped behind your kart.
  - 🍄 **Super Mushroom**: Instant rocket boost that cuts through off-road terrain.
  - ⭐ **Starman**: Rainbow invulnerability, max speed, and spins out opponents on contact.
  - ⚡ **Thunderbolt Lightning**: Zaps and shrinks all opponents ahead of you.

---

## 🔊 Standalone Procedural Audio Engine

KARTLAN 3D features a **100% standalone procedural Web Audio API synthesizer** requiring zero external audio file downloads:
- **Engine Rumble**: Dual-oscillator synth frequency-modulated by RPM and throttle.
- **Tire Screeches**: Bandpass-filtered white noise tracking drift slip velocity.
- **Boost Whooshes**: Low-pass resonant filter sweeps and sub-bass impact punches.
- **Retro-Arcade Soundtrack**: Dynamic multi-voice chiptune soundtrack with bassline, synth brass lead, drums, and final lap tempo acceleration!

---

## 🛠️ CLI Flags & Options

```bash
# Start standalone headless dedicated LAN server
node server.js --server --port 3030

# Start client with custom port without opening browser
kartlan --port 8080 --no-open
```

---

## 📜 License

MIT License © 2026 Augustalex
