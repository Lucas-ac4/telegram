import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config/gameConfig';
import { ModelBuilder, box, cylinder } from '../engine/geometry';
import { basic, curved, toon, toonVertexColors } from '../engine/materials';
import { cloudTexture, ledTexture, pitchTexture } from '../engine/textures';

const L = CONFIG.world.segmentLength;
const PITCH_HALF = 7;
const STEPS = 6;
const PEOPLE_PER_STEP = 9;

/**
 * Estadio infinito: tramos de 24 m que se reciclan (pool).
 * Cada tramo = césped + pista + carteles LED + tribunas + público + torres de luz.
 */
export class Stadium {
  private segments: THREE.Group[] = [];
  private led: THREE.CanvasTexture;

  constructor(scene: THREE.Scene) {
    const pitchMat = toon(0xffffff, { map: pitchTexture(CONFIG.lanes.width) });
    const pitchGeo = new THREE.PlaneGeometry(PITCH_HALF * 2, L, 1, 16);
    pitchGeo.rotateX(-Math.PI / 2);
    pitchGeo.translate(0, 0, -L / 2);

    const outerGeo = new THREE.PlaneGeometry(4, L, 1, 16);
    outerGeo.rotateX(-Math.PI / 2);
    const trackMat = toon(0xd9653b);

    this.led = ledTexture();
    this.led.repeat.set(2, 1);
    const ledMat = basic({ map: this.led });
    // Un cartel por lado, girado para mirar hacia la cancha.
    const ledGeos = [-1, 1].map((side) => {
      const g = new THREE.PlaneGeometry(L, 0.85, 16, 1);
      g.rotateY(side * -Math.PI / 2);
      g.translate(side * (PITCH_HALF + 0.5), 0.62, -L / 2);
      return g;
    });

    const standsGeo = buildStands();
    const standsMat = toonVertexColors();
    const lightsGeo = buildLightPanels();
    const lightsMat = basic({ color: 0xfffbe0 });

    const { body, head } = buildPerson();
    const crowdBodyMat = crowdMaterial();
    const crowdHeadMat = crowdMaterial();
    const count = STEPS * PEOPLE_PER_STEP * 2;

    for (let i = 0; i < CONFIG.world.segmentCount; i++) {
      const seg = new THREE.Group();
      seg.add(new THREE.Mesh(pitchGeo, pitchMat));
      for (const side of [-1, 1]) {
        const track = new THREE.Mesh(outerGeo, trackMat);
        track.position.set(side * (PITCH_HALF + 2), 0.005, -L / 2);
        seg.add(track);
        seg.add(new THREE.Mesh(ledGeos[side === -1 ? 0 : 1], ledMat));
      }
      seg.add(new THREE.Mesh(standsGeo, standsMat));
      seg.add(new THREE.Mesh(lightsGeo, lightsMat));

      const bodies = new THREE.InstancedMesh(body, crowdBodyMat, count);
      const heads = new THREE.InstancedMesh(head, crowdHeadMat, count);
      fillCrowd(bodies, heads);
      seg.add(bodies, heads);

      seg.position.z = -i * L + L / 2;
      scene.add(seg);
      this.segments.push(seg);
    }
    this.addClouds(scene);
  }

  /** Nubes de fondo: fijas, sin curvatura ni niebla (son parte del cielo). */
  private addClouds(scene: THREE.Scene): void {
    const mat = new THREE.MeshBasicMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, fog: false });
    const geo = new THREE.PlaneGeometry(1, 0.5);
    const spots: [number, number, number, number][] = [
      [-70, 34, -190, 60], [-10, 46, -210, 80], [55, 30, -180, 55], [110, 42, -200, 70], [-120, 26, -170, 50],
    ];
    for (const [x, y, z, w] of spots) {
      const cloud = new THREE.Mesh(geo, mat);
      cloud.position.set(x, y, z);
      cloud.scale.setScalar(w);
      cloud.renderOrder = -1;
      scene.add(cloud);
    }
  }

  reset(): void {
    this.segments.forEach((seg, i) => (seg.position.z = -i * L + L / 2));
  }

  update(dt: number, speed: number): void {
    const dz = speed * dt;
    for (const seg of this.segments) {
      seg.position.z += dz;
      // Tramo que quedó detrás de la cámara → se manda al final.
      if (seg.position.z - L > 12) seg.position.z -= L * this.segments.length;
    }
    this.led.offset.x = (this.led.offset.x + dt * 0.08) % 1;
  }
}

/** Material del público: cada persona salta a su ritmo (en el shader, costo ~0). */
function crowdMaterial(): THREE.MeshToonMaterial {
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff });
  return curved(mat, {
    key: 'crowd',
    afterBegin: `
      #ifdef USE_INSTANCING
        float ph = float(gl_InstanceID) * 1.37;
        float jumper = step(0.45, fract(ph * 0.61));
        transformed.y += max(0.0, sin(uTime * 7.0 + ph)) * 0.22 * jumper;
      #endif`,
  });
}

function buildPerson(): { body: THREE.BufferGeometry; head: THREE.BufferGeometry } {
  // Muy pocos polígonos: se dibujan cientos de personas.
  const head = new THREE.IcosahedronGeometry(0.17, 0);
  head.translate(0, 0.82, 0);
  // Cuerpo + brazos en alto (hinchada alentando).
  const body = new ModelBuilder()
    .add(new THREE.CylinderGeometry(0.17, 0.22, 0.62, 6), 0xffffff, [0, 0.33, 0])
    .add(new THREE.BoxGeometry(0.1, 0.38, 0.1), 0xffffff, [-0.25, 0.82, 0], [0, 0, 0.4])
    .add(new THREE.BoxGeometry(0.1, 0.38, 0.1), 0xffffff, [0.25, 0.82, 0], [0, 0, -0.4])
    .build();
  body.deleteAttribute('color');
  return { body, head };
}

const SHIRTS = [0x6cc3f5, 0xffffff, 0x6cc3f5, 0xffd23f, 0xe63946, 0x14213d, 0x6cc3f5, 0xffffff, 0x7cf29c];
const SKINS = [0xf2b98b, 0xd9956b, 0xa86b45, 0xf5cfa8, 0x7a4a2e];

function fillCrowd(bodies: THREE.InstancedMesh, heads: THREE.InstancedMesh): void {
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  let i = 0;
  for (const side of [-1, 1]) {
    for (let step = 0; step < STEPS; step++) {
      for (let k = 0; k < PEOPLE_PER_STEP; k++) {
        const x = side * (10.2 + step * 1.1 + Math.random() * 0.2);
        const y = 1.0 + step * 0.7;
        const z = -((k + 0.5 + (Math.random() - 0.5) * 0.5) * L) / PEOPLE_PER_STEP;
        m.makeRotationY(side * -Math.PI / 2 + (Math.random() - 0.5) * 0.6);
        m.setPosition(x, y, z);
        bodies.setMatrixAt(i, m);
        heads.setMatrixAt(i, m);
        bodies.setColorAt(i, c.setHex(SHIRTS[Math.floor(Math.random() * SHIRTS.length)]));
        heads.setColorAt(i, c.setHex(SKINS[Math.floor(Math.random() * SKINS.length)]));
        i++;
      }
    }
  }
  for (const mesh of [bodies, heads]) {
    mesh.frustumCulled = false;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}

/** Tribunas escalonadas + muro + torres de luz (todo en 1 geometría). */
function buildStands(): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const seatA = 0x2c4a9e;
  const seatB = 0x3a5fc4;
  for (const side of [-1, 1]) {
    // Muro perimetral.
    b.add(boxZ(0.4, 1.0, L), 0xf4f1f8, [side * 9.3, 0.5, -L / 2]);
    b.add(boxZ(0.42, 0.14, L), 0x14213d, [side * 9.3, 1.02, -L / 2]);
    for (let s = 0; s < STEPS; s++) {
      const h = 1.0 + s * 0.7;
      b.add(boxZ(1.1, h, L), s % 2 ? seatA : seatB, [side * (10.05 + s * 1.1), h / 2, -L / 2]);
    }
    // Pared trasera alta.
    const backX = side * (10.05 + STEPS * 1.1 + 0.3);
    b.add(boxZ(0.6, 7, L), 0x1d2f6b, [backX, 3.5, -L / 2]);
    b.add(boxZ(0.7, 0.3, L), 0xffd23f, [backX, 7, -L / 2]);
    // Torre de luz.
    b.add(cylinder(0.18, 0.25, 12, 8), 0x9aa5b1, [side * 17.5, 9.5, -2]);
    b.add(box(3.2, 1.8, 0.5, 0.1), 0x4b5563, [side * 17.5, 15.6, -2], [0, -side * 0.5, 0]);
  }
  return b.build();
}

function buildLightPanels(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const b = new ModelBuilder();
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 4; c++) b.add(new THREE.BoxGeometry(0.62, 0.62, 0.1), 0xffffff, [(c - 1.5) * 0.72, 0.36 - r * 0.72, 0.27]);
    }
    const g = b.build();
    // Mismo giro y posición que el cabezal de la torre.
    g.rotateY(-side * 0.5);
    g.translate(side * 17.5, 15.6, -2);
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false)!;
  merged.deleteAttribute('color');
  return merged;
}

/** Caja alargada en Z con subdivisiones (necesarias para que el mundo curvo no la deforme). */
function boxZ(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d, 1, 1, Math.ceil(d / 1.5));
}
