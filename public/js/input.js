/**
 * KARTLAN 3D - Universal Input Controller Engine
 * Supports Gamepad API (Xbox / PlayStation / Switch Pro / generic controllers
 * with analog triggers, steering, and vibration rumble), Keyboard, and Touch.
 */

export class InputController {
  constructor() {
    this.keys = {};
    this.gamepadIndex = null;
    this.touchControls = {
      steer: 0,
      accelerate: false,
      brake: false,
      drift: false,
      item: false
    };

    this.initKeyboard();
    this.initGamepad();
  }

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  initGamepad() {
    window.addEventListener('gamepadconnected', (e) => {
      console.log(`[Gamepad] Connected: ${e.gamepad.id}`);
      this.gamepadIndex = e.gamepad.index;
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      console.log(`[Gamepad] Disconnected`);
      if (this.gamepadIndex === e.gamepad.index) {
        this.gamepadIndex = null;
      }
    });
  }

  vibrate(intensity = 0.5, durationMs = 200) {
    if (this.gamepadIndex === null) return;
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[this.gamepadIndex];
    if (gp && gp.vibrationActuator && gp.vibrationActuator.playEffect) {
      gp.vibrationActuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration: durationMs,
        weakMagnitude: intensity,
        strongMagnitude: intensity
      }).catch(() => {});
    }
  }

  getState() {
    // 1. Keyboard mappings
    let accelerate = this.keys['KeyW'] || this.keys['ArrowUp'];
    let brake = this.keys['KeyS'] || this.keys['ArrowDown'];
    let steerLeft = this.keys['KeyA'] || this.keys['ArrowLeft'];
    let steerRight = this.keys['KeyD'] || this.keys['ArrowRight'];
    let drift = this.keys['Space'] || this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    let useItem = this.keys['KeyE'] || this.keys['Enter'] || this.keys['KeyF'];
    let lookBack = this.keys['KeyC'];
    let respawn = this.keys['KeyR'];
    let analogSteer = undefined;

    // 2. Gamepad API mappings
    if (this.gamepadIndex !== null) {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = gamepads[this.gamepadIndex];
      if (gp) {
        // Left stick steering (axis 0) with deadzone
        const stickX = gp.axes[0] || 0;
        if (Math.abs(stickX) > 0.15) {
          analogSteer = stickX;
        }

        // D-Pad
        if (gp.buttons[14] && gp.buttons[14].pressed) steerLeft = true;
        if (gp.buttons[15] && gp.buttons[15].pressed) steerRight = true;

        // Accelerate: Button A (0) or Right Trigger (7)
        if ((gp.buttons[0] && gp.buttons[0].pressed) || (gp.buttons[7] && gp.buttons[7].value > 0.1)) {
          accelerate = true;
        }

        // Brake/Reverse: Button B (1) or Left Trigger (6)
        if ((gp.buttons[1] && gp.buttons[1].pressed) || (gp.buttons[6] && gp.buttons[6].value > 0.1)) {
          brake = true;
        }

        // Drift/Hop: Right Bumper (5) or Button X (2)
        if ((gp.buttons[5] && gp.buttons[5].pressed) || (gp.buttons[2] && gp.buttons[2].pressed)) {
          drift = true;
        }

        // Use Item: Left Bumper (4) or Button Y (3)
        if ((gp.buttons[4] && gp.buttons[4].pressed) || (gp.buttons[3] && gp.buttons[3].pressed)) {
          useItem = true;
        }

        // Look Back: Right Stick Click (11)
        if (gp.buttons[11] && gp.buttons[11].pressed) {
          lookBack = true;
        }
      }
    }

    // 3. Touch mappings
    if (this.touchControls.accelerate) accelerate = true;
    if (this.touchControls.brake) brake = true;
    if (this.touchControls.drift) drift = true;
    if (this.touchControls.item) useItem = true;
    if (this.touchControls.steer !== 0) analogSteer = this.touchControls.steer;

    return {
      accelerate: !!accelerate,
      brake: !!brake,
      steerLeft: !!steerLeft,
      steerRight: !!steerRight,
      analogSteer,
      drift: !!drift,
      useItem: !!useItem,
      lookBack: !!lookBack,
      respawn: !!respawn
    };
  }
}

export { InputController as InputManager };
