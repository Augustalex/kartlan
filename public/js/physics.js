/**
 * KARTLAN 3D - Arcade Kart Physics & Collision Engine
 * Features: Raycast ground tracking, elastic track-boundary & kart-to-kart collisions,
 * hop & 3-tier drift mini-turbos, suspension dynamics, and drafting.
 */

import * as THREE from './three.module.min.js';
import { sound } from './audio.js';

export class KartPhysics {
  constructor(track, isLocal = true) {
    this.track = track;
    this.isLocal = isLocal;

    // Spatial State
    this.position = new THREE.Vector3(0, 0.05, 0);
    this.quaternion = new THREE.Quaternion();
    this.velocity = new THREE.Vector3();
    this.heading = 0;
    this.pitch = 0;
    this.roll = 0;
    this.verticalVelocity = 0;
    this.isGrounded = true;

    // Suspension & Grounding
    this.rideHeight = 0.04;
    this.radius = 1.6;

    // Speed & Handling Specs
    this.speed = 0;
    this.maxSpeed = 38.0;
    this.maxReverseSpeed = -14.0;
    this.acceleration = 25.0;
    this.braking = 34.0;
    this.drag = 4.2;
    this.turnRate = 2.45;

    // Drift State Machine
    this.isDrifting = false;
    this.driftDirection = 0;
    this.driftChargeTime = 0;
    this.driftTier = 0;
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

    // Camera FX
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

    // 1. Target Max Speed & Accelerations
    let currentMaxSpeed = this.maxSpeed;
    const isOffRoad = this.track.isOffRoad(this.position);
    const isBoosting = this.boostTimer > 0 || this.isInvincible;

    if (isBoosting) {
      currentMaxSpeed = 53.0;
    } else if (isOffRoad) {
      currentMaxSpeed = 16.0;
    }

    if (this.isZapped) {
      currentMaxSpeed *= 0.65;
    }

    // 2. Throttle & Braking
    let targetPitch = 0;
    if (input.accelerate) {
      targetPitch = 0.025;
      if (this.speed < currentMaxSpeed) {
        this.speed += this.acceleration * dt;
      } else {
        this.speed -= this.drag * 1.5 * dt;
      }
    } else if (input.brake) {
      targetPitch = -0.035;
      if (this.speed > 0) {
        this.speed -= this.braking * dt;
      } else if (this.speed > this.maxReverseSpeed) {
        this.speed -= this.acceleration * 0.7 * dt;
      }
    } else {
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
      const steerInfluence = steerAmount * this.driftDirection;
      const turnMultiplier = steerInfluence > 0 ? 1.35 : 0.75;
      this.heading += this.driftDirection * this.turnRate * turnMultiplier * dt * (this.speed / this.maxSpeed);

      const chargeRate = steerInfluence > 0 ? 1.4 : 0.8;
      this.driftChargeTime += dt * chargeRate;

      const prevTier = this.driftTier;
      if (this.driftChargeTime > 3.6) {
        this.driftTier = 3;
      } else if (this.driftChargeTime > 2.2) {
        this.driftTier = 2;
      } else if (this.driftChargeTime > 1.0) {
        this.driftTier = 1;
      }

      if (this.driftTier > prevTier && this.isLocal) {
        sound.playMiniTurboCharge(this.driftTier);
      }

      const targetVisualAngle = this.driftDirection * 0.42;
      this.driftVisualAngle = THREE.MathUtils.lerp(this.driftVisualAngle, targetVisualAngle, dt * 10);
    } else {
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

    // 6. Track Boundary & Guard Rail Collisions (Elastic Bounce)
    this.updateTrackBoundaryCollisions();

    // 7. Ground Elevation & Suspension Follower
    this.updateGrounding(dt);

    // 8. Boost Pads & Jump Ramps
    if (this.track.checkBoostPad(this.position)) {
      this.applyBoost(1.8, 1.4);
    }

    const rampHeight = this.track.checkJumpRamp(this.position);
    if (rampHeight > 0 && this.isGrounded) {
      this.verticalVelocity = Math.max(13.0, rampHeight * 2.5);
      this.isGrounded = false;
      if (this.isLocal) sound.playHop();
    }

    // 9. Drafting / Slipstream Detection
    this.updateDrafting(dt, otherKarts);

    // 10. Kart-to-Kart Elastic Collisions
    this.updateKartCollisions(dt, otherKarts);

    // 11. Checkpoints & Progression
    this.updateTrackProgress();

    // 12. Audio feedback
    if (this.isLocal) {
      const speedNorm = Math.abs(this.speed) / this.maxSpeed;
      sound.updateEngine(speedNorm, input.accelerate, isBoosting);
      sound.setDriftScreech(this.isDrifting, this.driftTier / 3.0 + 0.5);
    }

    // 13. Dynamic Slope Pitch & Chassis Banking
    const closest = this.track.findClosestWaypoint(this.position);
    const slopePitch = Math.atan2(closest.tangent.y, Math.hypot(closest.tangent.x, closest.tangent.z));
    const targetRoll = (this.isDrifting ? this.driftDirection * 0.08 : steerAmount * 0.05) * (this.speed / this.maxSpeed);

    this.pitch = THREE.MathUtils.lerp(this.pitch, targetPitch + slopePitch, dt * 8);
    this.roll = THREE.MathUtils.lerp(this.roll, targetRoll, dt * 8);

    const totalHeading = this.heading + this.driftVisualAngle;
    const euler = new THREE.Euler(this.pitch, totalHeading, this.roll, 'YXZ');
    this.quaternion.setFromEuler(euler);

    // Camera FX
    const targetFov = isBoosting ? 14 : (this.speed > 30 ? 6 : 0);
    this.fovKick = THREE.MathUtils.lerp(this.fovKick, targetFov, dt * 6);
    this.cameraShake = Math.max(0, this.cameraShake - dt * 2.5);
  }

  updateTrackBoundaryCollisions() {
    const { waypoint, lateralOffset, maxHalfWidth } = this.track.getTrackOffset(this.position);
    const barrierLimit = maxHalfWidth + 3.8;

    if (Math.abs(lateralOffset) > barrierLimit) {
      const sign = Math.sign(lateralOffset);
      const overshoot = Math.abs(lateralOffset) - barrierLimit;

      // Push back within boundaries
      this.position.addScaledVector(waypoint.binormal, -sign * overshoot * 1.2);

      // Elastic bumper bounce: reduce speed slightly and nudge heading toward center
      this.speed = Math.max(this.speed * 0.85, 0);
      const tangentHeading = Math.atan2(-waypoint.tangent.x, -waypoint.tangent.z);
      this.heading = THREE.MathUtils.lerp(this.heading, tangentHeading, 0.35);

      this.cameraShake = 0.35;
      if (this.isLocal) sound.playBananaSlip();
    }
  }

  updateDrift(dt, input) {
    const driftPressed = !!input.drift;

    if (driftPressed && !this.prevDriftButton && this.isGrounded) {
      this.verticalVelocity = 3.6;
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
    const targetY = closest.point.y + this.rideHeight;

    if (!this.isGrounded) {
      this.verticalVelocity -= 28.0 * dt;
      this.position.y += this.verticalVelocity * dt;

      if (this.position.y <= targetY) {
        this.position.y = targetY;
        this.verticalVelocity = 0;
        this.isGrounded = true;
      }
    } else {
      this.position.y = THREE.MathUtils.lerp(this.position.y, targetY, dt * 20);
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
        if (dot > 0.92) {
          inSlipstream = true;
          break;
        }
      }
    }

    if (inSlipstream && this.speed > 25) {
      this.draftTimer += dt;
      if (this.draftTimer >= 1.4) {
        this.applyBoost(2.0, 1.4);
        this.draftTimer = 0;
      }
    } else {
      this.draftTimer = Math.max(0, this.draftTimer - dt * 2.0);
    }
  }

  updateKartCollisions(dt, otherKarts) {
    const totalRadius = this.radius * 2;

    for (const other of otherKarts) {
      if (other === this) continue;
      const dx = this.position.x - other.position.x;
      const dz = this.position.z - other.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist < totalRadius && dist > 0.0001) {
        const nx = dx / dist;
        const nz = dz / dist;
        const overlap = totalRadius - dist;

        // Positional separation
        this.position.x += nx * overlap * 0.5;
        this.position.z += nz * overlap * 0.5;
        other.position.x -= nx * overlap * 0.5;
        other.position.z -= nz * overlap * 0.5;

        // Elastic momentum exchange
        const relVelX = this.velocity.x - other.velocity.x;
        const relVelZ = this.velocity.z - other.velocity.z;
        const velAlongNormal = relVelX * nx + relVelZ * nz;

        if (velAlongNormal < 0) {
          const restitution = 0.65;
          const impulse = -(1 + restitution) * velAlongNormal * 0.5;

          this.velocity.x += impulse * nx;
          this.velocity.z += impulse * nz;
          other.velocity.x -= impulse * nx;
          other.velocity.z -= impulse * nz;

          this.speed *= 0.92;
          other.speed *= 0.92;
        }

        if (this.isInvincible && !other.isInvincible) {
          other.spinOut();
        } else if (other.isInvincible && !this.isInvincible) {
          this.spinOut();
        } else {
          this.cameraShake = 0.35;
        }
      }
    }
  }

  updateTrackProgress() {
    const closest = this.track.findClosestWaypoint(this.position);
    this.lapProgress = closest.progress;

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
    this.heading += Math.PI * 4 * dt;
    const totalHeading = this.heading;
    this.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), totalHeading);
  }
}
