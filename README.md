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

## ⚡ Quickstart: Play or Update in 1 Step

### 🎮 For Your Friend (Single Command One-Liner):
Copy and paste this single command into any terminal (**Linux**, **macOS**, or **WSL on Windows**):

```bash
curl -sSL https://raw.githubusercontent.com/Augustalex/kartlan/main/install.sh | bash
```

> 💡 **Already ran this before?** Running the exact same command will **automatically pull the latest version**, update dependencies, and launch the game immediately!

#### If you already cloned the repo locally:
```bash
./update.sh   # Fetches the latest version
./play.sh     # Launches the game
```

---

## 🌐 How to Play Together over Wi-Fi LAN

Both players must be connected to the **same Wi-Fi network**.

### 1️⃣ Host (Player 1 - Hosting the Race):
1. Start the game on your computer:
   ```bash
   npm start
   # or run: ./play.sh
   ```
2. Your terminal will display your local Wi-Fi LAN link, for example:
   ```
   👉 http://192.168.50.131:3030
   ```
3. In the game menu in your browser (`http://localhost:3030`):
   - Choose your **Pilot Name** and **Kart Color**.
   - Click **⚡ HOST LAN RACE**.
   - Pick a track (**Neon Circuit**, **Sunset Canyon**, or **Galaxy Highway**).

---

### 2️⃣ Friend (Player 2 - Joining the Race):
Your friend can join using **any** of the following methods:

- **Method A: Direct Browser Link (Zero Install, Works on PC / Mac / Linux / iPad / Phone)**
  Open your web browser (Chrome, Firefox, Safari, Edge) and go directly to the host's Wi-Fi IP address:
  ```
  http://<HOST_IP>:3030
  ```
  *(Example: `http://192.168.50.131:3030`)*

- **Method B: Terminal One-Liner**
  Run the one-liner script:
  ```bash
  curl -sSL https://raw.githubusercontent.com/Augustalex/kartlan/main/install.sh | bash
  ```
  When the game opens, click **🔄 SCAN LAN** to automatically discover the host's room, then click **JOIN RACE**!

---

### 3️⃣ Starting the Race:
1. In the lobby, the friend clicks **SET READY**.
2. The host clicks **🏁 START RACE**.
3. The synchronized 3-2-1 countdown will trigger across all screens and launch the race!

---

## 🎮 Controls Reference

KARTLAN 3D supports **Keyboards**, **USB / Bluetooth Gamepads** (Xbox, PlayStation, Nintendo Switch Pro with rumble), and **Touch screens**:

| Action | Keyboard | Gamepad (Xbox / PS / Switch) | Touch / Mobile |
| :--- | :--- | :--- | :--- |
| **Accelerate** | `W` / `Up Arrow` | `Right Trigger (RT / R2)` / `A (✕)` | **GAS** Button |
| **Brake / Reverse** | `S` / `Down Arrow` | `Left Trigger (LT / L2)` / `B (○)` | **BRAKE** Button |
| **Steer** | `A` `D` / `Left` `Right` | `Left Analog Stick` / `D-Pad` | **◀ ▶** Buttons |
| **Hop & Drift** | `Space` / `Left Shift` | `Right Bumper (RB / R1)` / `X (□)` | **DRIFT** Button |
| **Use Item** | `E` / `Enter` / `F` | `Left Bumper (LB / L1)` / `Y (△)` | **ITEM** Button |
| **Look Back** | `C` | `Right Stick Click (R3)` | — |
| **Respawn / Reset** | `R` | `Select / Back` | — |

---

## 🏎️ Pro Driving & Mechanics Guide

### 💫 Drifting & 3-Tier Mini-Turbos:
1. **Hop into Drift**: While driving into a corner, press and hold **`Space`** (or **`RB`**) to hop and initiate a drift slide.
2. **Counter-Steer for Sparks**: Steer into the turn apex to charge your mini-turbo sparks:
   - 🔵 **Tier 1 (Cyan Sparks)**: +25% Speed Boost for 0.9s
   - 🟠 **Tier 2 (Orange Sparks)**: +48% Speed Boost for 1.7s
   - 🟣 **Tier 3 (Purple Sparks)**: +75% Speed Boost for 2.6s
3. **Release for Rocket Boost**: Release **`Space`** / **`RB`** to trigger an instant mini-turbo rocket surge!

### 💨 Slipstream / Drafting:
Tail directly behind an opponent kart for 1.4 seconds to catch their draft, triggering speed streaks and a free high-speed turbo boost!

### ⚡ Stunts & Jump Ramps:
Tap **`Space`** / **`RB`** as you hit the crest of a jump ramp to perform a stunt spin and receive a speed boost upon landing.

### 🛑 Off-Road Shortcuts:
Driving over grass, dirt, or sand slows your kart down to 40% speed unless you use a **Super Mushroom** or **Starman** to power straight through off-road shortcuts!

---

## 🛡️ Weapons & Item Guide

Drive through floating 3D **Question Mark Boxes** to collect items:

| Item | Icon | Effect |
| :--- | :---: | :--- |
| **Green Shell** | 🟢 | Fires in a straight line, ricocheting off barriers up to 4 times to hit opponents. |
| **Red Shell** | 🔴 | Homing projectile that navigates track waypoints to track down and flip the leader. |
| **Banana** | 🍌 | Drops a hazard trap behind your kart that causes victims to spin out 360°. |
| **Super Mushroom** | 🍄 | Grants an instant 3-second rocket surge that cuts through grass/sand without slowdown. |
| **Starman** | ⭐ | Rainbow invulnerability, top speed, and spins out any opponent on contact. |
| **Thunderbolt** | ⚡ | Strikes all opponents ahead of you with lightning, shrinking and slowing them for 5s. |

---

## 📦 Debian / Ubuntu Installation (.deb)

Download and install the native Debian package from [GitHub Releases](https://github.com/Augustalex/kartlan/releases):

```bash
# 1. Download Debian package
wget https://github.com/Augustalex/kartlan/releases/download/v1.0.0/kartlan_1.0.0_all.deb

# 2. Install package
sudo dpkg -i kartlan_1.0.0_all.deb
sudo apt-get install -f   # Resolves nodejs dependency if needed

# 3. Launch from terminal or Desktop Applications menu
kartlan
```

---

## 🔊 Standalone Synthesized Audio Engine

KARTLAN 3D contains a **100% standalone procedural Web Audio API synthesizer** with zero external audio dependencies:
- **Engine Sound**: Dual-oscillator synth frequency-modulated by RPM and throttle.
- **Drift Tire Screeches**: Bandpass-filtered white noise tracking drift slip velocity.
- **Mini-Turbo & Boost SFX**: Multi-tier chime chords, resonant filter sweeps, and sub-bass punches.
- **Dynamic Retro-Arcade Soundtrack**: 16-step sequencer with synth bass, drums, lead melody, and final lap tempo acceleration!

---

## 🛠️ CLI Options

```bash
# Start standalone headless dedicated LAN server
node server.js --server --port 3030

# Start client with custom port without opening browser
kartlan --port 8080 --no-open
```

---

## ❓ Troubleshooting & FAQs

- **Q: My friend cannot find my LAN race.**
  - **A**: Ensure both devices are connected to the exact same Wi-Fi network (not a Guest network or mobile data).
  - **A**: Have your friend enter your IP address directly into their browser: `http://<YOUR_IP>:3030` (e.g. `http://192.168.50.131:3030`).
- **Q: How do I update to the latest version?**
  - **A**: Simply re-run `curl -sSL https://raw.githubusercontent.com/Augustalex/kartlan/main/install.sh | bash` or run `./update.sh`.

---

## 📜 License

MIT License © 2026 Augustalex
