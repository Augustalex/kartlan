/**
 * KARTLAN 3D - 3D Kart Meshes & Visual FX Engine
 * Features: Authentic ground contact shadow, spinning tires, driver animations,
 * exhaust flame particles, and 3-tier drift spark particle systems.
 */

import * as THREE from './three.module.min.js';

export class KartVisual {
  constructor(scene, color = '#00f0ff', isLocal = false) {
    this.scene = scene;
    this.colorHex = color;
    this.isLocal = isLocal;
    this.group = new THREE.Group();
    this.kartRoot = new THREE.Group();
    this.group.add(this.kartRoot);

    this.bodyMesh = null;
    this.frontLeftWheel = null;
    this.frontRightWheel = null;
    this.rearLeftWheel = null;
    this.rearRightWheel = null;
    this.driverHead = null;
    this.steeringWheel = null;
    this.exhaustL = null;
    this.exhaustR = null;
    this.contactShadow = null;

    // Particle Systems
    this.driftSparks = null;
    this.driftSparksGeom = null;
    this.driftSparksPos = [];
    this.driftSparksColors = [];
    this.exhaustFlames = null;

    this.wheelRotation = 0;
    this.buildKart();
    this.buildContactShadow();
    this.buildDriftParticles();
    this.buildExhaustParticles();

    // Rotate kartRoot 180 degrees so nose points forward (-Z)
    this.kartRoot.rotation.y = Math.PI;

    this.scene.add(this.group);
  }

  buildKart() {
    const mainColor = new THREE.Color(this.colorHex);
    const darkChassis = new THREE.Color(0x1a1a1a);
    const chrome = new THREE.Color(0xcccccc);

    // 1. Lower Chassis
    const chassisGeom = new THREE.BoxGeometry(2.2, 0.35, 3.8);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: darkChassis,
      metalness: 0.8,
      roughness: 0.3
    });
    const chassis = new THREE.Mesh(chassisGeom, chassisMat);
    chassis.position.y = 0.38;
    chassis.castShadow = true;
    this.kartRoot.add(chassis);

    // 2. Main Body Shell
    const bodyGeom = new THREE.BoxGeometry(1.8, 0.45, 2.6);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: mainColor,
      metalness: 0.6,
      roughness: 0.2
    });
    this.bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
    this.bodyMesh.position.set(0, 0.65, -0.2);
    this.bodyMesh.castShadow = true;
    this.kartRoot.add(this.bodyMesh);

    // Nose Cone
    const noseGeom = new THREE.ConeGeometry(0.9, 1.4, 4);
    const nose = new THREE.Mesh(noseGeom, bodyMat);
    nose.rotation.x = Math.PI / 2;
    nose.rotation.y = Math.PI / 4;
    nose.position.set(0, 0.55, 1.6);
    this.kartRoot.add(nose);

    // Side Pods
    for (let side of [-1, 1]) {
      const podGeom = new THREE.BoxGeometry(0.35, 0.35, 1.8);
      const pod = new THREE.Mesh(podGeom, bodyMat);
      pod.position.set(side * 1.05, 0.55, -0.1);
      this.kartRoot.add(pod);
    }

    // 3. Engine Block & Dual Chrome Exhausts
    const engineGeom = new THREE.BoxGeometry(1.0, 0.55, 0.8);
    const engineMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.2 });
    const engine = new THREE.Mesh(engineGeom, engineMat);
    engine.position.set(0, 0.72, -1.3);
    this.kartRoot.add(engine);

    const pipeGeom = new THREE.CylinderGeometry(0.12, 0.14, 0.6, 12);
    const pipeMat = new THREE.MeshStandardMaterial({ color: chrome, metalness: 0.95, roughness: 0.1 });

    this.exhaustL = new THREE.Mesh(pipeGeom, pipeMat);
    this.exhaustL.rotation.x = Math.PI / 2 + 0.2;
    this.exhaustL.position.set(-0.35, 0.65, -1.8);
    this.kartRoot.add(this.exhaustL);

    this.exhaustR = new THREE.Mesh(pipeGeom, pipeMat);
    this.exhaustR.rotation.x = Math.PI / 2 + 0.2;
    this.exhaustR.position.set(0.35, 0.65, -1.8);
    this.kartRoot.add(this.exhaustR);

    // 4. Rear Spoiler Wing
    const wingGeom = new THREE.BoxGeometry(2.4, 0.1, 0.6);
    const wing = new THREE.Mesh(wingGeom, bodyMat);
    wing.position.set(0, 1.2, -1.6);
    this.kartRoot.add(wing);

    const strutGeom = new THREE.BoxGeometry(0.1, 0.55, 0.1);
    for (let side of [-0.8, 0.8]) {
      const strut = new THREE.Mesh(strutGeom, chassisMat);
      strut.position.set(side, 0.88, -1.6);
      this.kartRoot.add(strut);
    }

    // 5. Driver (Helmet & Visor)
    const driverGroup = new THREE.Group();
    const helmetGeom = new THREE.SphereGeometry(0.4, 16, 16);
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const helmet = new THREE.Mesh(helmetGeom, helmetMat);
    helmet.position.set(0, 1.05, 0.1);
    driverGroup.add(helmet);

    // Visor
    const visorGeom = new THREE.BoxGeometry(0.42, 0.18, 0.28);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.9,
      roughness: 0.1
    });
    const visor = new THREE.Mesh(visorGeom, visorMat);
    visor.position.set(0, 1.08, 0.3);
    driverGroup.add(visor);
    this.driverHead = driverGroup;
    this.kartRoot.add(this.driverHead);

    // 6. 4 Racing Wheels with Rims (Bottom touches y = 0.0)
    const createWheel = (radius, width) => {
      const wGroup = new THREE.Group();
      const tireGeom = new THREE.CylinderGeometry(radius, radius, width, 16);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
      const tire = new THREE.Mesh(tireGeom, tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wGroup.add(tire);

      const rimGeom = new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.02, 12);
      const rimMat = new THREE.MeshStandardMaterial({ color: chrome, metalness: 0.9, roughness: 0.1 });
      const rim = new THREE.Mesh(rimGeom, rimMat);
      rim.rotation.z = Math.PI / 2;
      wGroup.add(rim);

      return wGroup;
    };

    this.frontLeftWheel = createWheel(0.38, 0.35);
    this.frontLeftWheel.position.set(-1.25, 0.38, 1.2);
    this.kartRoot.add(this.frontLeftWheel);

    this.frontRightWheel = createWheel(0.38, 0.35);
    this.frontRightWheel.position.set(1.25, 0.38, 1.2);
    this.kartRoot.add(this.frontRightWheel);

    this.rearLeftWheel = createWheel(0.44, 0.48);
    this.rearLeftWheel.position.set(-1.3, 0.44, -1.2);
    this.kartRoot.add(this.rearLeftWheel);

    this.rearRightWheel = createWheel(0.44, 0.48);
    this.rearRightWheel.position.set(1.3, 0.44, -1.2);
    this.kartRoot.add(this.rearRightWheel);
  }

  buildContactShadow() {
    // Ground Contact Shadow Quad
    const shadowGeom = new THREE.PlaneGeometry(3.0, 4.4);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });
    this.contactShadow = new THREE.Mesh(shadowGeom, shadowMat);
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = 0.01;
    this.group.add(this.contactShadow);
  }

  buildDriftParticles() {
    const count = 120;
    this.driftSparksGeom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    this.sparkData = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -100;
      positions[i * 3 + 2] = 0;

      colors[i * 3] = 0;
      colors[i * 3 + 1] = 0.9;
      colors[i * 3 + 2] = 1.0;

      this.sparkData.push({
        active: false,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.2,
        vel: new THREE.Vector3()
      });
    }

    this.driftSparksGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.driftSparksGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const sparkMat = new THREE.PointsMaterial({
      size: 3.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });

    this.driftSparks = new THREE.Points(this.driftSparksGeom, sparkMat);
    this.scene.add(this.driftSparks);
  }

  buildExhaustParticles() {
    const count = 40;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    this.flameData = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -100;
      positions[i * 3 + 2] = 0;

      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.4;
      colors[i * 3 + 2] = 0.0;

      this.flameData.push({
        active: false,
        life: 0,
        maxLife: 0.2,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3()
      });
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 4.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });

    this.exhaustFlames = new THREE.Points(geom, mat);
    this.scene.add(this.exhaustFlames);
  }

  update(dt, speed, steer, driftTier, isBoosting, isInvincible, isZapped) {
    // 1. Wheel spin based on forward speed
    this.wheelRotation -= speed * dt * 2.8;
    this.frontLeftWheel.children[0].rotation.x = this.wheelRotation;
    this.frontRightWheel.children[0].rotation.x = this.wheelRotation;
    this.rearLeftWheel.children[0].rotation.x = this.wheelRotation;
    this.rearRightWheel.children[0].rotation.x = this.wheelRotation;

    // 2. Front wheel steering turn
    this.frontLeftWheel.rotation.y = -steer * 0.45;
    this.frontRightWheel.rotation.y = -steer * 0.45;

    // 3. Driver head tilt into turns
    if (this.driverHead) {
      this.driverHead.rotation.y = -steer * 0.35;
      this.driverHead.rotation.z = steer * 0.15;
    }

    // 4. Starman rainbow flash
    if (isInvincible) {
      const hue = (Date.now() % 1000) / 1000;
      const rainbowCol = new THREE.Color().setHSL(hue, 1.0, 0.5);
      this.bodyMesh.material.color.copy(rainbowCol);
    } else {
      this.bodyMesh.material.color.set(this.colorHex);
    }

    // 5. Zapped shrink effect
    if (isZapped) {
      this.group.scale.set(0.5, 0.5, 0.5);
    } else {
      this.group.scale.set(1.0, 1.0, 1.0);
    }

    // 6. Drift Sparks Update
    this.updateDriftSparks(dt, driftTier);

    // 7. Exhaust Flame Particles Update
    this.updateExhaustFlames(dt, isBoosting || speed > 35);
  }

  updateDriftSparks(dt, driftTier) {
    const posAttr = this.driftSparksGeom.attributes.position;
    const colAttr = this.driftSparksGeom.attributes.color;

    let sparkColor = [0, 0.9, 1.0];
    if (driftTier === 2) sparkColor = [1.0, 0.6, 0.0];
    if (driftTier === 3) sparkColor = [0.8, 0.1, 1.0];

    if (driftTier > 0) {
      const spawnCount = driftTier * 2;
      for (let s = 0; s < spawnCount; s++) {
        const pIdx = this.sparkData.findIndex(p => !p.active);
        if (pIdx !== -1) {
          const side = Math.random() > 0.5 ? -1 : 1;
          const rearWheelPos = side === -1 ? this.rearLeftWheel.position : this.rearRightWheel.position;
          const worldPos = rearWheelPos.clone().applyMatrix4(this.kartRoot.matrixWorld);

          const spark = this.sparkData[pIdx];
          spark.active = true;
          spark.life = 0;
          spark.maxLife = 0.25 + Math.random() * 0.15;
          spark.vel.set(
            (Math.random() - 0.5) * 6,
            Math.random() * 5 + 2,
            (Math.random() - 0.5) * 6
          );

          posAttr.setXYZ(pIdx, worldPos.x, worldPos.y, worldPos.z);
          colAttr.setXYZ(pIdx, sparkColor[0], sparkColor[1], sparkColor[2]);
        }
      }
    }

    for (let i = 0; i < this.sparkData.length; i++) {
      const spark = this.sparkData[i];
      if (spark.active) {
        spark.life += dt;
        if (spark.life >= spark.maxLife) {
          spark.active = false;
          posAttr.setXYZ(i, 0, -100, 0);
        } else {
          const px = posAttr.getX(i) + spark.vel.x * dt;
          const py = posAttr.getY(i) + spark.vel.y * dt;
          const pz = posAttr.getZ(i) + spark.vel.z * dt;
          spark.vel.y -= 15 * dt;
          posAttr.setXYZ(i, px, py, pz);
        }
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  updateExhaustFlames(dt, isBoosting) {
    const posAttr = this.exhaustFlames.geometry.attributes.position;
    const colAttr = this.exhaustFlames.geometry.attributes.color;

    if (isBoosting) {
      for (let p of [this.exhaustL, this.exhaustR]) {
        const pIdx = this.flameData.findIndex(f => !f.active);
        if (pIdx !== -1) {
          const worldPos = p.position.clone().applyMatrix4(this.kartRoot.matrixWorld);
          const flame = this.flameData[pIdx];
          flame.active = true;
          flame.life = 0;
          flame.vel.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 15 + Math.random() * 10);
          flame.vel.applyQuaternion(this.group.quaternion);

          posAttr.setXYZ(pIdx, worldPos.x, worldPos.y, worldPos.z);
          colAttr.setXYZ(pIdx, 0.2, 0.8, 1.0);
        }
      }
    }

    for (let i = 0; i < this.flameData.length; i++) {
      const f = this.flameData[i];
      if (f.active) {
        f.life += dt;
        if (f.life >= f.maxLife) {
          f.active = false;
          posAttr.setXYZ(i, 0, -100, 0);
        } else {
          posAttr.setXYZ(
            i,
            posAttr.getX(i) + f.vel.x * dt,
            posAttr.getY(i) + f.vel.y * dt,
            posAttr.getZ(i) + f.vel.z * dt
          );
        }
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  destroy() {
    this.scene.remove(this.group);
    if (this.driftSparks) this.scene.remove(this.driftSparks);
    if (this.exhaustFlames) this.scene.remove(this.exhaustFlames);
  }
}
