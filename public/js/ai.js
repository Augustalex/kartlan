/**
 * KARTLAN 3D - AI Bot Racer Controller
 * Navigates track waypoints, calculates apex steering lines, drifts around turns,
 * and uses items strategically.
 */

import * as THREE from './three.module.min.js';

export class BotController {
  constructor(botId, track, physics) {
    this.botId = botId;
    this.track = track;
    this.physics = physics;

    // Personality variations
    this.aggressiveness = 0.85 + Math.random() * 0.3;
    this.targetOffset = (Math.random() - 0.5) * (this.track.config.roadWidth * 0.4);
    this.lookaheadProgress = 0.035;
    this.itemUseCooldown = 2.0 + Math.random() * 3.0;
  }

  update(dt, currentItem = null) {
    const currentProgress = this.physics.lapProgress;
    const targetProgress = (currentProgress + this.lookaheadProgress) % 1.0;
    const targetWp = this.track.getWaypointAtProgress(targetProgress);

    // Desired world position along track width
    const targetPos = new THREE.Vector3().copy(targetWp.point).addScaledVector(targetWp.binormal, this.targetOffset);

    // Vector to target
    const toTarget = new THREE.Vector3().subVectors(targetPos, this.physics.position);
    const targetAngle = Math.atan2(-toTarget.x, -toTarget.z);

    // Calculate angle difference
    let angleDiff = targetAngle - this.physics.heading;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // Steering input
    let steerAmount = Math.max(-1.0, Math.min(1.0, angleDiff * 2.2));

    // Sharp turn detection -> Drift!
    let drift = false;
    if (Math.abs(angleDiff) > 0.45 && this.physics.speed > 20) {
      drift = true;
    }

    // Accelerate / Brake logic
    let accelerate = true;
    let brake = false;
    if (Math.abs(angleDiff) > 1.1 && this.physics.speed > 28) {
      brake = true;
      accelerate = false;
    }

    // Item use decision
    let useItem = false;
    this.itemUseCooldown -= dt;
    if (currentItem && this.itemUseCooldown <= 0) {
      useItem = true;
      this.itemUseCooldown = 3.0 + Math.random() * 4.0;
    }

    return {
      accelerate,
      brake,
      steerLeft: steerAmount > 0.1,
      steerRight: steerAmount < -0.1,
      analogSteer: -steerAmount,
      drift,
      useItem,
      lookBack: false
    };
  }
}
