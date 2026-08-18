/**
 * KARTLAN 3D - Arcade Kart Physics & Controller Engine
 * Features: Raycast-assisted grounding, hop & 3-tier drift mini-turbos,
 * counter-steering dynamics, drafting/slipstream, jump ramp stunts, and bumping.
 */

import * as THREE from './three.module.min.js';
import { sound } from './audio.js';

export class KartPhysics {
  constructor(track, isLocal = true) {
    this.track = track;
    this.isLocal = isLocal;

    // Spatial State
    this.position = new THREE.Vector3(0, 0.5, 0);
    this.quaternion = new THREE.Quaternion();
    this.velocity = new THREE.Vector3();
    this.heading = 0; // Y-axis rotation in radians
    this.pitch = 0;
    this.roll = 0;
    this.verticalVelocity = 0;
    this.isGrounded = true;

    // Speed & Acceleration Specs
    this.speed = 0;
    this.maxSpeed = 38.0;
    this.maxReverseSpeed = -14.0;
    this.acceleration = 24.0;
    this.braking = 32.0;
    this.drag = 4.0;
    this.turnRate = 2.4;

    // Drift State Machine
    this.isDrifting = false;
    this.driftDirection = 0; // -1 (left), +1 (right)
    this.driftChargeTime = 0;
    this.driftTier = 0; // 0, 1 (blue), 2 (orange), 3 (purple)
    this.driftVisualAngle = 0;
    this.prevDriftButton = false;

    // Boost System
    this.boostTimer = 0;
    this.boostMultiplier = 1.0;

    // Drafting / Slipstream
    this.draftTimer = 0;
    this.isDrafting = false;

    // Status Effects
    this.isInvincible = false;
    this.invincibleTimer = 0;
    this.isZapped = false;
    this.zappedTimer = 0;
    this.spinOutTimer = 0;

    // Checkpoints & Progress
    this.lapProgress = 0;
    this.currentLap = 1;
    this.lastClosestWpIndex = 0;

    // Camera Lookahead & Shake
    this.cameraShake = 0;
    this.fovKick = 0;
  }

  setPosition(x, y, z, heading = 0) {
    this.position.set(x, y, z);
    this.heading = heading;
    this.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading);
    this.velocity.set(0, 0, 0);
    this.speed = 0;
  }

  update(dt, input, otherKarts = []) {
    if (this.spinOutTimer > 0) {
      this.updateSpinOut(dt);
      return;
    }

    this.updateTimers(dt);

    // 1. Calculate Target Max Speed & Accelerations
    let currentMaxSpeed = this.maxSpeed;
    const isOffRoad = this.track.isOffRoad(this.position);
    const isBoosting = this.boostTimer > 0 || this.isInvincible;

    if (isBoosting) {
      currentMaxSpeed = 52.0;
    } else if (isOffRoad) {
      currentMaxSpeed = 16.0; // Off-road slow down unless boosting
    }

    if (this.isZapped) {
      currentMaxSpeed *= 0.65;
    }

    // 2. Throttle & Braking
    if (input.accelerate) {
      if (this.speed < currentMaxSpeed) {
        this.speed += this.acceleration * dt;
      } else {
        this.speed -= this.drag * 1.5 * dt;
      }
    } else if (input.brake) {
      if (this.speed > 0) {
        this.speed -= this.braking * dt;
      } else if (this.speed > this.maxReverseSpeed) {
        this.speed -= this.acceleration * 0.7 * dt;
      }
    } else {
      // Natural rolling drag
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - this.drag * dt);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + this.drag * dt);
      }
    }

    // 3. Hop & Drift Mechanics
    this.updateDrift(dt, input);

    // 4. Steering Dynamics
    let steerAmount = 0;
    if (input.steerLeft) steerAmount += 1;
    if (input.steerRight) steerAmount -= 1;
    if (input.analogSteer !== undefined) steerAmount = -input.analogSteer;

    if (this.isDrifting) {
      // Drift steering: base drift turn + counter-steer slip adjustment
      const steerInfluence = steerAmount * this.driftDirection;
      const turnMultiplier = steerInfluence > 0 ? 1.35 : 0.75;
      this.heading += this.driftDirection * this.turnRate * turnMultiplier * dt * (this.speed / this.maxSpeed);

      // Charge mini-turbo sparks
      const chargeRate = steerInfluence > 0 ? 1.4 : 0.8;
      this.driftChargeTime += dt * chargeRate;

      const prevTier = this.driftTier;
      if (this.driftChargeTime > 3.8) {
        this.driftTier = 3; // Purple
      } else if (this.driftChargeTime > 2.3) {
        this.driftTier = 2; // Orange
      } else if (this.driftChargeTime > 1.1) {
        this.driftTier = 1; // Blue
      }

      if (this.driftTier > prevTier && this.isLocal) {
        sound.playMiniTurboCharge(this.driftTier);
      }

      // Smooth visual drift tilt angle
      const targetVisualAngle = this.driftDirection * 0.45;
      this.driftVisualAngle = THREE.MathUtils.lerp(this.driftVisualAngle, targetVisualAngle, dt * 10);
    } else {
      // Normal steering (scaled with speed)
      if (Math.abs(this.speed) > 0.5) {
        const speedFactor = Math.min(Math.abs(this.speed) / (this.maxSpeed * 0.7), 1.0);
        this.heading += steerAmount * this.turnRate * speedFactor * dt * Math.sign(this.speed);
      }
      this.driftVisualAngle = THREE.MathUtils.lerp(this.driftVisualAngle, 0, dt * 8);
    }

    // 5. Update Velocity & Position
    const forwardX = -Math.sin(this.heading);
    const forwardZ = -Math.cos(this.heading);

    this.velocity.x = forwardX * this.speed;
    this.velocity.z = forwardZ * this.speed;

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // 6. Raycast & Ground Elevation Following
    this.updateGrounding(dt);

    // 7. Check Boost Pads & Jump Ramps
    if (this.track.checkBoostPad(this.position)) {
      this.applyBoost(1.8, 1.4);
    }

    const rampHeight = this.track.checkJumpRamp(this.position);
    if (rampHeight > 0 && this.isGrounded) {
      this.verticalVelocity = Math.max(12.0, rampHeight * 2.2);
      this.isGrounded = false;
      if (this.isLocal) sound.playHop();
    }

    // 8. Drafting / Slipstream Detection
    this.updateDrafting(dt, otherKarts);

    // 9. Kart-to-Kart Elastic Bumping
    this.updateKartCollisions(dt, otherKarts);

    // 10. Update Checkpoints & Track Progression
    this.updateTrackProgress();

    // 11. Audio feedback
    if (this.isLocal) {
      const speedNorm = Math.abs(this.speed) / this.maxSpeed;
      sound.updateEngine(speedNorm, input.accelerate, isBoosting);
      sound.setDriftScreech(this.isDrifting, this.driftTier / 3.0 + 0.5);
    }

    // Update quaternion with heading and visual drift offset
    const totalHeading = this.heading + this.driftVisualAngle;
    this.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), totalHeading);

    // Smooth camera FOV kick
    const targetFov = isBoosting ? 14 : (this.speed > 30 ? 6 : 0);
    this.fovKick = THREE.MathUtils.lerp(this.fovKick, targetFov, dt * 6);
    this.cameraShake = Math.max(0, this.cameraShake - dt * 2.5);
  }

  updateDrift(dt, input) {
    const driftPressed = !!input.drift;

    // On Button Down -> Hop!
    if (driftPressed && !this.prevDriftButton && this.isGrounded) {
      this.verticalVelocity = 4.2;
      this.isGrounded = false;
      if (this.isLocal) sound.playHop();

      let steerAmount = 0;
      if (input.steerLeft) steerAmount += 1;
      if (input.steerRight) steerAmount -= 1;
      if (input.analogSteer !== undefined) steerAmount = -input.analogSteer;

      if (Math.abs(steerAmount) > 0.15 && this.speed > 10) {
        this.isDrifting = true;
        this.driftDirection = Math.sign(steerAmount);
        this.driftChargeTime = 0;
        this.driftTier = 0;
      }
    }

    // On Button Release -> Release Mini-Turbo Boost!
    if (!driftPressed && this.prevDriftButton && this.isDrifting) {
      this.isDrifting = false;
      if (this.driftTier > 0) {
        const boostDurations = [0, 0.9, 1.7, 2.6];
        const boostMults = [1.0, 1.28, 1.48, 1.75];
        this.applyBoost(boostDurations[this.driftTier], boostMults[this.driftTier]);
        this.cameraShake = 0.4 * this.driftTier;
      }
      this.driftTier = 0;
      this.driftChargeTime = 0;
    }

    // Cancel drift if slowed down to a stop
    if (this.isDrifting && this.speed < 6) {
      this.isDrifting = false;
      this.driftTier = 0;
      this.driftChargeTime = 0;
    }

    this.prevDriftButton = driftPressed;
  }

  applyBoost(duration, multiplier = 1.35) {
    this.boostTimer = Math.max(this.boostTimer, duration);
    this.boostMultiplier = multiplier;
    this.speed = Math.max(this.speed, this.maxSpeed * multiplier);
    if (this.isLocal) sound.playTurboBoost();
  }

  updateGrounding(dt) {
    const closest = this.track.findClosestWaypoint(this.position);
    const targetY = closest.point.y + 0.45;

    if (!this.isGrounded) {
      this.verticalVelocity -= 28.0 * dt; // Gravity
      this.position.y += this.verticalVelocity * dt;

      if (this.position.y <= targetY) {
        this.position.y = targetY;
        this.verticalVelocity = 0;
        this.isGrounded = true;
      }
    } else {
      // Snap to road height with smooth spring damping
      this.position.y = THREE.MathUtils.lerp(this.position.y, targetY, dt * 15);
    }
  }

  updateDrafting(dt, otherKarts) {
    if (this.isDrafting && this.boostTimer > 0) return;

    let inSlipstream = false;
    const forwardVec = new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));

    for (const other of otherKarts) {
      if (other === this) continue;
      const toOther = new THREE.Vector3().subVectors(other.position, this.position);
      const dist = toOther.length();

      if (dist > 3.0 && dist < 18.0) {
        const dot = forwardVec.dot(toOther.clone().normalize());
        if (dot > 0.92) { // Directly in front cone
          inSlipstream = true;
          break;
        }
      }
    }

    if (inSlipstream && this.speed > 25) {
      this.draftTimer += dt;
      if (this.draftTimer >= 1.4) {
        // Slipstream turbo triggered!
        this.applyBoost(2.0, 1.4);
        this.draftTimer = 0;
      }
    } else {
      this.draftTimer = Math.max(0, this.draftTimer - dt * 2.0);
    }
  }

  updateKartCollisions(dt, otherKarts) {
    const kartRadius = 1.8;
    for (const other of otherKarts) {
      if (other === this) continue;
      const dx = this.position.x - other.position.x;
      const dz = this.position.z - other.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist < kartRadius * 2 && dist > 0.001) {
        // Overlap detected! Elastic impulse push
        const nx = dx / dist;
        const nz = dz / dist;
        const overlap = (kartRadius * 2 - dist) * 0.5;

        this.position.x += nx * overlap;
        this.position.z += nz * overlap;

        // If one kart has Starman invincibility, spin out the other!
        if (this.isInvincible && !other.isInvincible) {
          other.spinOut();
        } else if (other.isInvincible && !this.isInvincible) {
          this.spinOut();
        } else {
          // Normal bump impulse
          this.speed *= 0.92;
          this.cameraShake = 0.3;
        }
      }
    }
  }

  updateTrackProgress() {
    const closest = this.track.findClosestWaypoint(this.position);
    this.lapProgress = closest.progress;

    // Check lap completion (cross from end of track ~0.9 to start ~0.1)
    const prevIdx = this.lastClosestWpIndex;
    const currIdx = closest.index;
    const totalWp = this.track.waypoints.length;

    if (prevIdx > totalWp * 0.8 && currIdx < totalWp * 0.2) {
      this.currentLap++;
    }

    this.lastClosestWpIndex = currIdx;
  }

  updateTimers(dt) {
    if (this.boostTimer > 0) {
      this.boostTimer -= dt;
      if (this.boostTimer <= 0) {
        this.boostMultiplier = 1.0;
      }
    }

    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt;
      if (this.invincibleTimer <= 0) {
        this.isInvincible = false;
      }
    }

    if (this.zappedTimer > 0) {
      this.zappedTimer -= dt;
      if (this.zappedTimer <= 0) {
        this.isZapped = false;
      }
    }
  }

  spinOut() {
    this.spinOutTimer = 1.2;
    this.speed = 0;
    this.isDrifting = false;
    this.driftTier = 0;
    this.cameraShake = 0.8;
    if (this.isLocal) sound.playBananaSlip();
  }

  updateSpinOut(dt) {
    this.spinOutTimer -= dt;
    this.heading += Math.PI * 4 * dt; // 720 degree spin
    const totalHeading = this.heading;
    this.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), totalHeading);
  }
}
