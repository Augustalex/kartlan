/**
 * KARTLAN 3D - 3D Item Box & Weapons Engine
 * Implements 3D spinning translucent question mark item boxes,
 * Green Shells, Red Shells (homing), Banana Hazards, Mushrooms, Star, Lightning.
 */

import * as THREE from './three.module.min.js';
import { sound } from './audio.js';

export class ItemManager {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.itemBoxes = [];
    this.projectiles = new Map(); // id -> { mesh, type, ... }

    this.buildItemBoxes();
  }

  buildItemBoxes() {
    const boxCount = 10;
    for (let i = 0; i < boxCount; i++) {
      const u = (i + 0.5) / boxCount;
      const wp = this.track.getWaypointAtProgress(u);

      // Create a set of 3 item boxes side by side across road width
      for (let offset of [-4, 0, 4]) {
        const boxId = this.itemBoxes.length;
        const boxGroup = new THREE.Group();

        // 1. Outer Translucent Rainbow Cube
        const outerGeom = new THREE.BoxGeometry(1.6, 1.6, 1.6);
        const outerMat = new THREE.MeshStandardMaterial({
          color: 0x00f0ff,
          emissive: 0x00aacc,
          emissiveIntensity: 0.6,
          transparent: true,
          opacity: 0.65,
          roughness: 0.1,
          metalness: 0.5
        });
        const outerCube = new THREE.Mesh(outerGeom, outerMat);
        boxGroup.add(outerCube);

        // 2. Inner Question Mark Core
        const innerGeom = new THREE.OctahedronGeometry(0.7);
        const innerMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
        const innerCore = new THREE.Mesh(innerGeom, innerMat);
        boxGroup.add(innerCore);

        const pos = new THREE.Vector3().copy(wp.point).addScaledVector(wp.binormal, offset);
        boxGroup.position.set(pos.x, pos.y + 1.2, pos.z);

        this.scene.add(boxGroup);

        this.itemBoxes.push({
          id: boxId,
          mesh: boxGroup,
          active: true,
          position: boxGroup.position
        });
      }
    }
  }

  update(dt) {
    const time = Date.now() * 0.003;
    for (const box of this.itemBoxes) {
      if (box.active) {
        box.mesh.visible = true;
        box.mesh.rotation.y += dt * 2.5;
        box.mesh.rotation.x = Math.sin(time + box.id) * 0.2;
        box.mesh.position.y += Math.sin(time * 2 + box.id) * 0.005;
      } else {
        box.mesh.visible = false;
      }
    }

    for (const [id, proj] of this.projectiles.entries()) {
      if (proj.type === 'GREEN_SHELL' || proj.type === 'RED_SHELL') {
        proj.mesh.rotation.y += dt * 15;
      } else if (proj.type === 'BANANA') {
        proj.mesh.rotation.y += dt * 1.5;
      }
    }
  }

  checkItemBoxCollisions(kartPosition) {
    for (const box of this.itemBoxes) {
      if (!box.active) continue;
      const dx = kartPosition.x - box.position.x;
      const dz = kartPosition.z - box.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 2.4) {
        box.active = false;
        return box.id;
      }
    }
    return null;
  }

  checkKartCollision(kartPosition) {
    return this.checkItemBoxCollisions(kartPosition);
  }

  collectBox(boxId) {
    const box = this.itemBoxes.find(b => b.id === boxId);
    if (box) {
      box.active = false;
      box.mesh.visible = false;
    }
  }

  respawnBox(boxId) {
    const box = this.itemBoxes.find(b => b.id === boxId);
    if (box) {
      box.active = true;
      box.mesh.visible = true;
    }
  }

  spawnProjectileVisual(projData) {
    if (this.projectiles.has(projData.id)) return;

    let mesh;
    if (projData.type === 'GREEN_SHELL' || projData.type === 'RED_SHELL') {
      const isRed = projData.type === 'RED_SHELL';
      const shellGroup = new THREE.Group();

      const domeGeom = new THREE.SphereGeometry(0.8, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      const domeMat = new THREE.MeshStandardMaterial({
        color: isRed ? 0xff1122 : 0x00dd33,
        roughness: 0.3,
        metalness: 0.4
      });
      const dome = new THREE.Mesh(domeGeom, domeMat);
      shellGroup.add(dome);

      const rimGeom = new THREE.TorusGeometry(0.8, 0.15, 8, 16);
      const rimMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
      const rim = new THREE.Mesh(rimGeom, rimMat);
      rim.rotation.x = Math.PI / 2;
      shellGroup.add(rim);

      mesh = shellGroup;
    } else if (projData.type === 'BANANA') {
      const bananaGeom = new THREE.ConeGeometry(0.5, 1.2, 6);
      const bananaMat = new THREE.MeshStandardMaterial({ color: 0xffdd00, roughness: 0.4 });
      mesh = new THREE.Mesh(bananaGeom, bananaMat);
    }

    if (mesh) {
      mesh.position.set(projData.position.x, projData.position.y + 0.4, projData.position.z);
      this.scene.add(mesh);
      this.projectiles.set(projData.id, {
        id: projData.id,
        type: projData.type,
        mesh
      });
    }
  }

  updateProjectileVisual(projData) {
    const proj = this.projectiles.get(projData.id);
    if (proj) {
      proj.mesh.position.set(projData.pos[0], projData.pos[1] + 0.4, projData.pos[2]);
    } else {
      this.spawnProjectileVisual({
        id: projData.id,
        type: projData.type,
        position: { x: projData.pos[0], y: projData.pos[1], z: projData.pos[2] }
      });
    }
  }

  destroyProjectileVisual(projId) {
    const proj = this.projectiles.get(projId);
    if (proj) {
      this.scene.remove(proj.mesh);
      this.projectiles.delete(projId);
    }
  }

  reset() {
    for (const proj of this.projectiles.values()) {
      this.scene.remove(proj.mesh);
    }
    this.projectiles.clear();
    for (const box of this.itemBoxes) {
      box.active = true;
      box.mesh.visible = true;
    }
  }
}
