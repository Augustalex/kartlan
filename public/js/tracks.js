/**
 * KARTLAN 3D - Track Generator & Geometry Engine
 * Creates rich 3D tracks with banked curves, curbs, boost zippers, jump ramps,
 * checkpoints, waypoints, and environment scenery.
 */

import * as THREE from './three.module.min.js';

export const TRACK_CONFIGS = {
  circuit_neon: {
    id: 'circuit_neon',
    name: 'Circuit Neon',
    theme: 'cyberpunk',
    skyColor: 0x070b19,
    fogColor: 0x070b19,
    roadColor: 0x181e2e,
    curbColorA: 0x00f0ff,
    curbColorB: 0xff0055,
    roadWidth: 16,
    points: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 80),
      new THREE.Vector3(30, 2, 160),
      new THREE.Vector3(90, 4, 200),
      new THREE.Vector3(170, 0, 180),
      new THREE.Vector3(200, 0, 120),
      new THREE.Vector3(180, 0, 50),
      new THREE.Vector3(220, 5, -20),
      new THREE.Vector3(250, 0, -100),
      new THREE.Vector3(200, 0, -180),
      new THREE.Vector3(120, 0, -210),
      new THREE.Vector3(30, 0, -180),
      new THREE.Vector3(-40, 0, -120),
      new THREE.Vector3(-40, 0, -40)
    ],
    boostPads: [
      { progress: 0.15, offset: 0 },
      { progress: 0.52, offset: 3 },
      { progress: 0.85, offset: -3 }
    ],
    jumpRamps: [
      { progress: 0.42, height: 4.5 }
    ]
  },

  sunset_canyon: {
    id: 'sunset_canyon',
    name: 'Sunset Canyon',
    theme: 'desert',
    skyColor: 0x2e1115,
    fogColor: 0xd47043,
    roadColor: 0x3d271d,
    curbColorA: 0xffaa00,
    curbColorB: 0xaa3300,
    roadWidth: 18,
    points: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 100),
      new THREE.Vector3(50, 8, 180),
      new THREE.Vector3(140, 14, 210),
      new THREE.Vector3(220, 10, 160),
      new THREE.Vector3(250, 2, 80),
      new THREE.Vector3(200, -2, 0),
      new THREE.Vector3(150, 0, -80),
      new THREE.Vector3(190, 6, -170),
      new THREE.Vector3(140, 12, -240),
      new THREE.Vector3(40, 6, -230),
      new THREE.Vector3(-60, 0, -170),
      new THREE.Vector3(-60, 0, -60)
    ],
    boostPads: [
      { progress: 0.22, offset: -2 },
      { progress: 0.68, offset: 2 }
    ],
    jumpRamps: [
      { progress: 0.35, height: 6.0 },
      { progress: 0.78, height: 5.0 }
    ]
  },

  galaxy_space: {
    id: 'galaxy_space',
    name: 'Galaxy Highway',
    theme: 'space',
    skyColor: 0x02000a,
    fogColor: 0x120224,
    roadColor: 0x0c0620,
    curbColorA: 0xff00ff,
    curbColorB: 0x00ffff,
    roadWidth: 17,
    points: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 90),
      new THREE.Vector3(60, 5, 170),
      new THREE.Vector3(150, 12, 190),
      new THREE.Vector3(230, 8, 130),
      new THREE.Vector3(210, 0, 40),
      new THREE.Vector3(260, -4, -40),
      new THREE.Vector3(270, 4, -140),
      new THREE.Vector3(180, 10, -210),
      new THREE.Vector3(80, 5, -220),
      new THREE.Vector3(-20, 0, -180),
      new THREE.Vector3(-80, 0, -90),
      new THREE.Vector3(-50, 0, -20)
    ],
    boostPads: [
      { progress: 0.12, offset: 0 },
      { progress: 0.45, offset: -3 },
      { progress: 0.65, offset: 3 },
      { progress: 0.88, offset: 0 }
    ],
    jumpRamps: [
      { progress: 0.28, height: 7.0 },
      { progress: 0.58, height: 6.0 }
    ]
  }
};

export class Track {
  constructor(scene, trackId = 'circuit_neon') {
    this.scene = scene;
    this.config = TRACK_CONFIGS[trackId] || TRACK_CONFIGS.circuit_neon;
    this.curve = null;
    this.waypoints = []; // ~300 dense sampled waypoints
    this.totalLength = 0;
    this.roadMesh = null;
    this.curbsMesh = null;
    this.barriersMesh = null;
    this.decorations = [];
    this.boostPads = [];
    this.jumpRamps = [];
    this.finishLineMesh = null;

    this.build();
  }

  build() {
    // Create smooth closed CatmullRom spline
    this.curve = new THREE.CatmullRomCurve3(this.config.points, true, 'catmullrom', 0.5);

    // Sample dense waypoints along spline
    const sampleCount = 350;
    this.waypoints = [];
    for (let i = 0; i < sampleCount; i++) {
      const u = i / sampleCount;
      const point = this.curve.getPointAt(u);
      const tangent = this.curve.getTangentAt(u).normalize();
      const normal = new THREE.Vector3(0, 1, 0);
      const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
      this.waypoints.push({
        index: i,
        progress: u,
        point,
        tangent,
        binormal
      });
    }
    this.totalLength = this.curve.getLength();

    this.generateRoadGeometry();
    this.generateCurbsAndBarriers();
    this.generateBoostPadsAndRamps();
    this.generateEnvironment();
    this.generateFinishLine();
  }

  generateRoadGeometry() {
    const halfWidth = this.config.roadWidth / 2;
    const segments = this.waypoints.length;
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const uvs = [];
    const normals = [];
    const indices = [];

    for (let i = 0; i <= segments; i++) {
      const wp = this.waypoints[i % segments];
      const left = new THREE.Vector3().copy(wp.point).addScaledVector(wp.binormal, -halfWidth);
      const right = new THREE.Vector3().copy(wp.point).addScaledVector(wp.binormal, halfWidth);

      vertices.push(left.x, left.y + 0.05, left.z);
      vertices.push(right.x, right.y + 0.05, right.z);

      normals.push(0, 1, 0);
      normals.push(0, 1, 0);

      const v = i / 4; // texture repeat
      uvs.push(0, v);
      uvs.push(1, v);
    }

    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const roadMat = new THREE.MeshStandardMaterial({
      color: this.config.roadColor,
      roughness: 0.75,
      metalness: 0.2
    });

    this.roadMesh = new THREE.Mesh(geometry, roadMat);
    this.roadMesh.receiveShadow = true;
    this.scene.add(this.roadMesh);

    // Center dash markings
    this.generateCenterDashes();
  }

  generateCenterDashes() {
    const segments = this.waypoints.length;
    const geom = new THREE.BufferGeometry();
    const positions = [];
    for (let i = 0; i < segments; i += 3) {
      const wp1 = this.waypoints[i];
      const wp2 = this.waypoints[(i + 1) % segments];
      positions.push(wp1.point.x, wp1.point.y + 0.08, wp1.point.z);
      positions.push(wp2.point.x, wp2.point.y + 0.08, wp2.point.z);
    }
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 });
    const line = new THREE.LineSegments(geom, mat);
    this.scene.add(line);
  }

  generateCurbsAndBarriers() {
    const halfWidth = this.config.roadWidth / 2;
    const segments = this.waypoints.length;
    const curbWidth = 1.2;

    // Create alternating colored curbs
    for (let side of [-1, 1]) {
      const curbGeom = new THREE.BufferGeometry();
      const vertices = [];
      const colors = [];
      const indices = [];

      for (let i = 0; i <= segments; i++) {
        const wp = this.waypoints[i % segments];
        const innerOffset = side * halfWidth;
        const outerOffset = side * (halfWidth + curbWidth);

        const inner = new THREE.Vector3().copy(wp.point).addScaledVector(wp.binormal, innerOffset);
        const outer = new THREE.Vector3().copy(wp.point).addScaledVector(wp.binormal, outerOffset);

        vertices.push(inner.x, inner.y + 0.12, inner.z);
        vertices.push(outer.x, outer.y + 0.12, outer.z);

        const isEven = Math.floor(i / 2) % 2 === 0;
        const col = new THREE.Color(isEven ? this.config.curbColorA : this.config.curbColorB);
        colors.push(col.r, col.g, col.b);
        colors.push(col.r, col.g, col.b);
      }

      for (let i = 0; i < segments; i++) {
        const a = i * 2;
        const b = i * 2 + 1;
        const c = (i + 1) * 2;
        const d = (i + 1) * 2 + 1;
        indices.push(a, b, c);
        indices.push(b, d, c);
      }

      curbGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      curbGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      curbGeom.setIndex(indices);
      curbGeom.computeVertexNormals();

      const curbMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.6,
        metalness: 0.3
      });
      const curbMesh = new THREE.Mesh(curbGeom, curbMat);
      this.scene.add(curbMesh);
    }
  }

  generateBoostPadsAndRamps() {
    // Boost Pads (zipper pads)
    for (const pad of this.config.boostPads) {
      const wp = this.getWaypointAtProgress(pad.progress);
      const pos = new THREE.Vector3().copy(wp.point).addScaledVector(wp.binormal, pad.offset);

      const padGeom = new THREE.PlaneGeometry(6, 9);
      const padMat = new THREE.MeshBasicMaterial({
        color: 0x00ffea,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(padGeom, padMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(pos);
      mesh.position.y += 0.1;
      mesh.lookAt(pos.clone().add(wp.tangent));
      mesh.rotateX(-Math.PI / 2);

      this.scene.add(mesh);
      this.boostPads.push({
        mesh,
        position: pos,
        radius: 4.5
      });
    }

    // Jump Ramps
    for (const ramp of this.config.jumpRamps) {
      const wp = this.getWaypointAtProgress(ramp.progress);
      const rampGeom = new THREE.BoxGeometry(this.config.roadWidth - 2, ramp.height, 12);
      const rampMat = new THREE.MeshStandardMaterial({
        color: 0xffaa00,
        metalness: 0.5,
        roughness: 0.4
      });
      const rampMesh = new THREE.Mesh(rampGeom, rampMat);
      rampMesh.position.copy(wp.point);
      rampMesh.position.y += ramp.height / 2;
      rampMesh.lookAt(wp.point.clone().add(wp.tangent));
      this.scene.add(rampMesh);

      this.jumpRamps.push({
        position: wp.point,
        height: ramp.height,
        radius: 6.0
      });
    }
  }

  generateFinishLine() {
    const wp = this.waypoints[0];
    const halfWidth = this.config.roadWidth / 2;

    // Checkered banner arch
    const archGroup = new THREE.Group();

    // Left & Right Pillars
    const pillarGeom = new THREE.CylinderGeometry(0.8, 0.8, 12, 16);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 });

    const leftPillar = new THREE.Mesh(pillarGeom, pillarMat);
    leftPillar.position.copy(wp.point).addScaledVector(wp.binormal, -halfWidth - 1.5);
    leftPillar.position.y += 6;

    const rightPillar = new THREE.Mesh(pillarGeom, pillarMat);
    rightPillar.position.copy(wp.point).addScaledVector(wp.binormal, halfWidth + 1.5);
    rightPillar.position.y += 6;

    // Cross beam
    const beamGeom = new THREE.BoxGeometry(this.config.roadWidth + 4, 2.5, 2);
    const beamMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x0066aa,
      emissiveIntensity: 0.5
    });
    const beam = new THREE.Mesh(beamGeom, beamMat);
    beam.position.copy(wp.point);
    beam.position.y += 11;
    beam.lookAt(wp.point.clone().add(wp.binormal));

    archGroup.add(leftPillar);
    archGroup.add(rightPillar);
    archGroup.add(beam);
    this.scene.add(archGroup);
    this.finishLineMesh = archGroup;
  }

  generateEnvironment() {
    const theme = this.config.theme;

    if (theme === 'cyberpunk') {
      // Ground plane
      const groundGeom = new THREE.PlaneGeometry(800, 800, 32, 32);
      const groundMat = new THREE.MeshStandardMaterial({ color: 0x030611, roughness: 0.9 });
      const ground = new THREE.Mesh(groundGeom, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.2;
      this.scene.add(ground);

      // Neon Skyscraper Towers in background
      for (let i = 0; i < 45; i++) {
        const height = 40 + Math.random() * 90;
        const width = 18 + Math.random() * 25;
        const geom = new THREE.BoxGeometry(width, height, width);
        const col = Math.random() > 0.5 ? 0x0a152d : 0x160826;
        const mat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.7, roughness: 0.3 });
        const building = new THREE.Mesh(geom, mat);

        const angle = Math.random() * Math.PI * 2;
        const dist = 180 + Math.random() * 200;
        building.position.set(Math.cos(angle) * dist, height / 2, Math.sin(angle) * dist);
        this.scene.add(building);

        // Neon roof edge
        const edgeGeom = new THREE.BoxGeometry(width + 0.5, 1.5, width + 0.5);
        const edgeMat = new THREE.MeshBasicMaterial({
          color: Math.random() > 0.5 ? 0x00f0ff : 0xff0077
        });
        const edge = new THREE.Mesh(edgeGeom, edgeMat);
        edge.position.set(building.position.x, height, building.position.z);
        this.scene.add(edge);
      }
    } else if (theme === 'desert') {
      // Desert canyon terrain
      const groundGeom = new THREE.PlaneGeometry(800, 800, 48, 48);
      const pos = groundGeom.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const heightVal = Math.sin(vx * 0.02) * Math.cos(vy * 0.02) * 12;
        pos.setZ(i, heightVal);
      }
      groundGeom.computeVertexNormals();

      const groundMat = new THREE.MeshStandardMaterial({ color: 0x9c4826, roughness: 0.95 });
      const ground = new THREE.Mesh(groundGeom, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -2;
      this.scene.add(ground);

      // Cacti / Canyon Rocks
      for (let i = 0; i < 35; i++) {
        const rockGeom = new THREE.DodecahedronGeometry(8 + Math.random() * 12, 1);
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x6e3118, roughness: 0.9 });
        const rock = new THREE.Mesh(rockGeom, rockMat);
        const angle = Math.random() * Math.PI * 2;
        const dist = 140 + Math.random() * 180;
        rock.position.set(Math.cos(angle) * dist, 6, Math.sin(angle) * dist);
        rock.scale.set(1 + Math.random(), 1.5 + Math.random() * 2, 1 + Math.random());
        this.scene.add(rock);
      }
    } else if (theme === 'space') {
      // Starfield particles
      const starGeom = new THREE.BufferGeometry();
      const starPositions = [];
      const starColors = [];
      for (let i = 0; i < 2000; i++) {
        starPositions.push(
          (Math.random() - 0.5) * 1600,
          (Math.random() - 0.5) * 800 + 100,
          (Math.random() - 0.5) * 1600
        );
        const col = new THREE.Color().setHSL(Math.random(), 0.8, 0.7);
        starColors.push(col.r, col.g, col.b);
      }
      starGeom.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
      starGeom.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
      const starMat = new THREE.PointsMaterial({ size: 2.5, vertexColors: true });
      const starField = new THREE.Points(starGeom, starMat);
      this.scene.add(starField);

      // Distant Floating Planet
      const planetGeom = new THREE.SphereGeometry(60, 32, 32);
      const planetMat = new THREE.MeshStandardMaterial({
        color: 0x8a2be2,
        emissive: 0x3d0c66,
        roughness: 0.8
      });
      const planet = new THREE.Mesh(planetGeom, planetMat);
      planet.position.set(-300, 180, -400);
      this.scene.add(planet);
    }
  }

  getWaypointAtProgress(u) {
    const normalized = ((u % 1) + 1) % 1;
    const index = Math.floor(normalized * this.waypoints.length);
    return this.waypoints[index % this.waypoints.length];
  }

  findClosestWaypoint(position) {
    let closestWp = this.waypoints[0];
    let minDistSq = Infinity;

    for (let i = 0; i < this.waypoints.length; i++) {
      const wp = this.waypoints[i];
      const dx = position.x - wp.point.x;
      const dz = position.z - wp.point.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        closestWp = wp;
      }
    }
    return closestWp;
  }

  isOffRoad(position) {
    const closest = this.findClosestWaypoint(position);
    const dx = position.x - closest.point.x;
    const dz = position.z - closest.point.z;
    const dist = Math.hypot(dx, dz);
    return dist > (this.config.roadWidth / 2 + 1.5);
  }

  checkBoostPad(position) {
    for (const pad of this.boostPads) {
      const dx = position.x - pad.position.x;
      const dz = position.z - pad.position.z;
      if (Math.hypot(dx, dz) < pad.radius) {
        return true;
      }
    }
    return false;
  }

  checkJumpRamp(position) {
    for (const ramp of this.jumpRamps) {
      const dx = position.x - ramp.position.x;
      const dz = position.z - ramp.position.z;
      if (Math.hypot(dx, dz) < ramp.radius) {
        return ramp.height;
      }
    }
    return 0;
  }
}
