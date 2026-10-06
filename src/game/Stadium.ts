import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config/gameConfig';
import { ModelBuilder, box, cylinder } from '../engine/geometry';
import { basic, curved, toon, toonVertexColors } from '../engine/materials';
import {
  BANNER_DESIGNS,
  bannersTexture,
  CROWD_COLS,
  cloudTexture,
  crowdTexture,
  glowTexture,
  ledTexture,
  pitchTexture,
  screenTexture,
  seatsTexture,
  trackTexture,
} from '../engine/textures';
import type { Theme } from '../config/themes';
import type { Quality } from '../config/quality';

const L = CONFIG.world.segmentLength;
const LANES = CONFIG.lanes.count;
/** Medio ancho de la cancha: los carriles ocupan el centro con un margen de ~1.2 m a cada lado. */
const PITCH_HALF = (LANES * CONFIG.lanes.width) / 2 + 1.2;
const TRACK_W = 1.9;
const WALL_X = PITCH_HALF + TRACK_W + 0.2;
const STEP_W = 1.1;
const STEP0 = WALL_X + 0.75;
const STEPS = 6;
const TOWER_X = STEP0 + STEPS * STEP_W + 1.8;

interface Segment {
  group: THREE.Group;
  pitch: THREE.Mesh;
}

/**
 * Estadio infinito: tramos de 24 m que se reciclan (pool).
 * Cada tramo = césped (con marcas de cancha variables) + pista + carteles LED + tribunas con
 * asientos + público + pantalla gigante + túneles + torres de luz.
 */
export class Stadium {
  private segments: Segment[] = [];
  private pitchMats: THREE.MeshLambertMaterial[];
  private led: THREE.CanvasTexture;
  private cloudMat!: THREE.MeshBasicMaterial;
  private stars!: THREE.Points;
  private disc!: THREE.Mesh;
  private discMat!: THREE.MeshBasicMaterial;
  private glowMat: THREE.MeshBasicMaterial;
  private crowdFx = { value: 1 };
  private crowdMat = crowdCardMaterial(this.crowdFx);

  constructor(scene: THREE.Scene) {
    this.pitchMats = ([0, 1, 2] as const).map((v) => toon(0xffffff, { map: pitchTexture(LANES, CONFIG.lanes.width, PITCH_HALF, v) }));
    const pitchGeo = new THREE.PlaneGeometry(PITCH_HALF * 2, L, 1, 16);
    pitchGeo.rotateX(-Math.PI / 2);
    pitchGeo.translate(0, 0, -L / 2);

    const trackTex = trackTexture();
    trackTex.repeat.set(1, L / 6);
    const trackMat = toon(0xffffff, { map: trackTex });
    const outerGeo = new THREE.PlaneGeometry(TRACK_W, L, 1, 16);
    outerGeo.rotateX(-Math.PI / 2);

    this.led = ledTexture();
    this.led.repeat.set(2, 1);
    const ledMat = basic({ map: this.led });
    // Un cartel por lado, girado para mirar hacia la cancha.
    const ledGeos = [-1, 1].map((side) => {
      const g = new THREE.PlaneGeometry(L, 0.85, 16, 1);
      g.rotateY(side * -Math.PI / 2);
      g.translate(side * (PITCH_HALF + 0.3), 0.62, -L / 2);
      return g;
    });

    const standsGeo = buildStands();
    const seatsTex = seatsTexture();
    const standsMat = toonVertexColors({ map: seatsTex });
    const lightsGeo = buildLightPanels();
    const lightsMat = basic({ color: 0xfffbe0 });

    // Pantalla gigante en la pared trasera.
    const screenMat = basic({ map: screenTexture() });
    const screenGeos = [-1, 1].map((side) => {
      const g = new THREE.PlaneGeometry(5.4, 1.7);
      g.rotateY(side * -Math.PI / 2);
      g.translate(side * (STEP0 + STEPS * STEP_W - 0.04 - 0.55 + 0.55), 5.1, -11.5);
      return g;
    });

    // Trapos colgados y banderas que flamean.
    const bannerTex = bannersTexture();
    const bannersGeo = buildBanners();
    const bannersMat = toon(0xffffff, { map: bannerTex, side: THREE.DoubleSide });
    const flagsGeo = buildFlags();
    const flagsMat = curved(new THREE.MeshLambertMaterial({ map: bannerTex, side: THREE.DoubleSide }), {
      key: 'flag',
      header: 'attribute float flagT;',
      afterBegin: 'transformed.x += sin(uTime * 7.0 + position.z * 2.5 + position.y) * 0.22 * flagT;',
    });

    // Brillo de los reflectores (sólo de noche / atardecer).
    this.glowMat = basic({
      map: glowTexture('rgba(255,250,225,1)', 'rgba(255,240,200,0.5)'),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glowGeo = new THREE.PlaneGeometry(5.5, 5.5);

    // Público: tarjetas con una hinchada pintada (1 draw call por tramo).
    const crowdGeo = buildCrowdCards();
    const crowdMat = this.crowdMat;

    for (let i = 0; i < CONFIG.world.segmentCount; i++) {
      const seg = new THREE.Group();
      const pitch = new THREE.Mesh(pitchGeo, this.pitchMats[0]);
      pitch.receiveShadow = true;
      seg.add(pitch);
      for (const side of [-1, 1]) {
        const track = new THREE.Mesh(outerGeo, trackMat);
        track.position.set(side * (PITCH_HALF + TRACK_W / 2), 0.005, -L / 2);
        seg.add(track);
        seg.add(new THREE.Mesh(ledGeos[side === -1 ? 0 : 1], ledMat));
        seg.add(new THREE.Mesh(screenGeos[side === -1 ? 0 : 1], screenMat));
      }
      seg.add(new THREE.Mesh(standsGeo, standsMat));
      seg.add(new THREE.Mesh(lightsGeo, lightsMat));
      seg.add(new THREE.Mesh(bannersGeo, bannersMat));
      seg.add(new THREE.Mesh(flagsGeo, flagsMat));
      for (const side of [-1, 1]) {
        const glow = new THREE.Mesh(glowGeo, this.glowMat);
        glow.position.set(side * (TOWER_X - 0.2), 15.6, -1.4);
        glow.renderOrder = 2;
        seg.add(glow);
      }

      seg.add(new THREE.Mesh(crowdGeo, crowdMat));

      seg.position.z = -i * L + L / 2;
      scene.add(seg);
      this.segments.push({ group: seg, pitch });
    }
    this.addClouds(scene);
  }

  /** Nubes de fondo: fijas, sin curvatura ni niebla (son parte del cielo). */
  private addClouds(scene: THREE.Scene): void {
    const mat = new THREE.MeshBasicMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, fog: false });
    this.cloudMat = mat;
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

    // Estrellas para los partidos de noche.
    const pos: number[] = [];
    for (let i = 0; i < 260; i++) {
      const az = (Math.random() - 0.5) * Math.PI * 1.3;
      const el = 0.12 + Math.random() * 0.9;
      const r = 230;
      pos.push(Math.sin(az) * Math.cos(el) * r, Math.sin(el) * r, -Math.cos(az) * Math.cos(el) * r);
    }
    const geo2 = new THREE.BufferGeometry();
    geo2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.stars = new THREE.Points(
      geo2,
      new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }),
    );
    this.stars.visible = false;
    scene.add(this.stars);

    // Sol / luna.
    this.discMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false });
    this.disc = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.discMat);
    this.disc.renderOrder = -2;
    scene.add(this.disc);
  }

  /** Calidad: en LOW el público no salta ni hay flashes de cámara. */
  setQuality(q: Quality): void {
    this.crowdFx.value = q.ambientFx ? 1 : 0;
  }

  applyTheme(theme: Theme): void {
    this.cloudMat.color.setHex(theme.cloudColor);
    this.cloudMat.opacity = theme.cloudOpacity;
    this.stars.visible = theme.stars;
    this.discMat.map?.dispose();
    this.discMat.map = glowTexture(theme.disc.inner, theme.disc.outer);
    this.discMat.needsUpdate = true;
    this.disc.position.set(...theme.disc.pos);
    this.disc.scale.setScalar(theme.disc.size);
    this.glowMat.visible = theme.floodlights;
  }

  reset(): void {
    this.segments.forEach((seg, i) => {
      seg.group.position.z = -i * L + L / 2;
      seg.pitch.material = this.pitchMats[0];
    });
  }

  update(dt: number, speed: number): void {
    const dz = speed * dt;
    for (const seg of this.segments) {
      seg.group.position.z += dz;
      // Tramo que quedó detrás de la cámara → se manda al final con otra marca de cancha.
      if (seg.group.position.z - L > 12) {
        seg.group.position.z -= L * this.segments.length;
        const r = Math.random();
        seg.pitch.material = this.pitchMats[r < 0.55 ? 0 : r < 0.78 ? 1 : 2];
      }
    }
    this.led.offset.x = (this.led.offset.x + dt * 0.08) % 1;
  }
}

/** Material del público: tarjetas con recorte, salto por persona y flashes de cámara (todo en el shader). */
function crowdCardMaterial(fx: { value: number }): THREE.MeshLambertMaterial {
  const mat = curved(new THREE.MeshLambertMaterial({ map: crowdTexture(), alphaTest: 0.5, side: THREE.DoubleSide }), { key: 'crowdcard' });
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer);
    shader.uniforms.uFx = fx;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform float uFx;\nfloat h1(float n){return fract(sin(n*12.9898)*43758.5453);}`)
      .replace(
        '#include <map_fragment>',
        `
        vec2 cuv = vMapUv;
        float colId = floor(cuv.x * ${CROWD_COLS}.0);
        float cell = fract(cuv.x * ${CROWD_COLS}.0) - 0.5;
        float isAct = step(0.6, fract(colId * 0.618034));
        float ph = h1(colId) * 6.2831;
        cuv.y -= uFx * isAct * max(0.0, sin(uTime * 7.0 + ph)) * 0.07;
        vec4 sampledDiffuseColor = texture2D(map, cuv);
        diffuseColor *= sampledDiffuseColor;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
        // Flash de cámara: un destello corto y brillante sobre la cabeza de algunas personas.
        float cam = step(0.86, h1(colId + 7.0));
        float fl = pow(max(0.0, sin(uTime * (1.5 + h1(colId) * 2.5) + h1(colId + 3.0) * 40.0)), 120.0);
        float dd = length(vec2(cell * 46.0, (vMapUv.y - 0.64) * 160.0));
        gl_FragColor.rgb += uFx * cam * fl * smoothstep(9.0, 0.0, dd) * vec3(3.0, 3.0, 2.6);`,
      );
  };
  mat.customProgramCacheKey = () => 'crowdcard';
  return mat;
}

/** Una tarjeta de público por escalón y lado, con 8 cortes en Z (el mundo curvo las dobla bien). */
function buildCrowdCards(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    for (let st = 0; st < STEPS; st++) {
      const g = new THREE.PlaneGeometry(L, 0.95, 8, 1);
      g.rotateY(side * -Math.PI / 2);
      g.translate(side * (STEP0 + st * STEP_W + 0.12), 1.0 + st * 0.7 + 0.45, -L / 2);
      // Cada fila arranca en otro punto de la textura (no se repiten patrones entre escalones).
      const uv = g.attributes.uv;
      const off = (st * 0.37 + (side > 0 ? 0.5 : 0)) % 1;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 2 + off);
      parts.push(g);
    }
  }
  return mergeGeometries(parts, false)!;
}

/** Mapeo UV "de caja": cada cara usa su plano; la textura se repite cada `tile` metros. */
function boxUV(g: THREE.BufferGeometry, tileU: number, tileV: number): void {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    let u: number;
    let v: number;
    if (nx > 0.5) {
      u = pos.getZ(i);
      v = pos.getY(i);
    } else if (ny > 0.5) {
      u = pos.getX(i);
      v = pos.getZ(i);
    } else {
      u = pos.getX(i);
      v = pos.getY(i);
    }
    uv[i * 2] = u / tileU;
    uv[i * 2 + 1] = v / tileV;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** Tribunas con asientos por sectores + muro + túneles + banco de suplentes + torres de luz (todo en 1 geometría). */
function buildStands(): THREE.BufferGeometry {
  const sectorColors = [0x3a58a8, 0xe9eef8, 0x3a58a8, 0x2c8a4a];
  const parts: THREE.BufferGeometry[] = [];
  const seated = new ModelBuilder(); // con textura de asientos (se les calcula UV)
  const plain = new ModelBuilder(); // sin textura (UV 0)
  for (const side of [-1, 1]) {
    // Muro perimetral blanco con friso.
    plain.add(boxZ(0.4, 1.0, L), 0xf4f1f8, [side * WALL_X, 0.5, -L / 2]);
    plain.add(boxZ(0.42, 0.14, L), 0x14213d, [side * WALL_X, 1.02, -L / 2]);
    // Escalones: cada uno dividido en 3 sectores de color (como las populares de verdad).
    for (let st = 0; st < STEPS; st++) {
      const h = 1.0 + st * 0.7;
      const sectorL = L / 3;
      for (let k = 0; k < 3; k++) {
        const color = sectorColors[(st + k) % sectorColors.length];
        seated.add(boxZ(STEP_W, h, sectorL - 0.06), color, [side * (STEP0 + st * STEP_W), h / 2, -k * sectorL - sectorL / 2]);
      }
    }
    // Pared trasera alta, con friso dorado.
    const backX = side * (STEP0 + STEPS * STEP_W + 0.3);
    plain.add(boxZ(0.6, 7, L), 0x26335f, [backX, 3.5, -L / 2]);
    plain.add(boxZ(0.7, 0.3, L), 0xe8b93c, [backX, 7, -L / 2]);
    // Túneles de acceso (vomitorios) con marco: aparecen cada tramo.
    const tx = side * (STEP0 + 2 * STEP_W + 0.56);
    plain.add(new THREE.BoxGeometry(0.1, 1.5, 2.3), 0x090b14, [tx, 1.0 + 2 * 0.7 + 0.75, -6]);
    plain.add(new THREE.BoxGeometry(0.14, 0.14, 2.6), 0xe8b93c, [tx, 1.0 + 2 * 0.7 + 1.55, -6]);
    // Techo de la tribuna con cartelera y cercha.
    const roofX = side * (STEP0 + (STEPS * STEP_W) / 2 - 0.3);
    plain.add(boxZ(STEPS * STEP_W + 1.6, 0.22, L), 0xdfe4ec, [roofX, 7.9, -L / 2], [0, 0, side * 0.1]);
    plain.add(boxZ(0.12, 0.5, L), 0x26335f, [side * (WALL_X + 0.25), 7.45, -L / 2]);
    for (const z of [-3, -9, -15, -21]) {
      plain.add(new THREE.BoxGeometry(STEPS * STEP_W + 1.4, 0.1, 0.1), 0x8d97a8, [roofX, 7.72, z], [0, 0, side * 0.1]);
    }
    // Banco de suplentes (techo curvo + asientos).
    const bx = side * (PITCH_HALF + 1.05);
    plain.add(new THREE.BoxGeometry(0.12, 1.3, 3.4), 0x26335f, [bx + side * 0.5, 0.65, -12]);
    plain.add(
      new THREE.CylinderGeometry(0.9, 0.9, 3.4, 12, 1, true, 0, Math.PI),
      0xcfe3f2,
      [bx + side * 0.1, 0.95, -12],
      [Math.PI / 2, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0],
    );
    for (let k = 0; k < 4; k++) plain.add(box(0.4, 0.42, 0.62, 0.08), 0xd7263d, [bx + side * 0.2, 0.21, -13.2 + k * 0.8]);
    // Banderines de córner a lo largo de la línea.
    for (const z of [-2, -14]) {
      plain.add(cylinder(0.025, 0.025, 1.3, 6), 0xf4f1f8, [side * (PITCH_HALF - 0.1), 0.65, z]);
      plain.add(new THREE.ConeGeometry(0.22, 0.42, 3), z === -2 ? 0xffd23f : 0xd7263d, [side * (PITCH_HALF - 0.1), 1.12, z - 0.22], [Math.PI / 2, 0, 0]);
    }
    // Torre de luz.
    plain.add(cylinder(0.18, 0.25, 12, 8), 0x9aa5b1, [side * TOWER_X, 9.5, -2]);
    plain.add(box(3.2, 1.8, 0.5, 0.1), 0x4b5563, [side * TOWER_X, 15.6, -2], [0, -side * 0.5, 0]);
  }
  const sg = seated.build();
  boxUV(sg, 2.0, 1.4);
  const pg = plain.build();
  // Lo que no son asientos toma un punto blanco de la textura (así conserva su color).
  const white = new Float32Array(pg.attributes.position.count * 2);
  for (let i = 0; i < white.length; i += 2) {
    white[i] = 0.12;
    white[i + 1] = 0.8;
  }
  pg.setAttribute('uv', new THREE.BufferAttribute(white, 2));
  parts.push(sg, pg);
  return mergeGeometries(parts, false)!;
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
    g.translate(side * TOWER_X, 15.6, -2);
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false)!;
  merged.deleteAttribute('color');
  return merged;
}

/** Caja alargada en Z con subdivisiones (necesarias para que el mundo curvo no la deforme). */
function boxZ(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d, 1, 1, Math.max(1, Math.ceil(d / 4)));
}

/** Trapos colgados en la pared trasera de cada tribuna (1 geometría por tramo). */
function buildBanners(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  let k = 0;
  for (const side of [-1, 1]) {
    const x = side * (STEP0 + STEPS * STEP_W - 0.02);
    for (const z of [-3.5, -19.5]) {
      const g = new THREE.PlaneGeometry(4.2, 1.5, 6, 1);
      remapCell(g, k++ % BANNER_DESIGNS);
      g.rotateY(side * -Math.PI / 2);
      g.translate(x, 5.25, z);
      parts.push(g);
    }
  }
  return mergeGeometries(parts, false)!;
}

/** Banderas en mástiles dentro de la hinchada; `flagT` = distancia al mástil (para el flameo). */
function buildFlags(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  let k = 1;
  for (const side of [-1, 1]) {
    for (const [step, z] of [[2, -6], [4, -17]] as const) {
      const x = side * (STEP0 + step * STEP_W);
      const y = 1.0 + step * 0.7 + 1.9;
      const cloth = new THREE.PlaneGeometry(1.6, 0.9, 8, 1);
      remapCell(cloth, k++ % BANNER_DESIGNS);
      // Distancia al mástil (0 en el mástil, 1 en la punta).
      const pos = cloth.attributes.position;
      const t = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) t[i] = (pos.getX(i) + 0.8) / 1.6;
      cloth.setAttribute('flagT', new THREE.BufferAttribute(t, 1));
      cloth.rotateY(Math.PI / 2);
      cloth.translate(x, y, z - 0.8);
      parts.push(cloth);
      const pole = new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6);
      pole.translate(x, y - 0.85, z);
      const n = pole.attributes.position.count;
      pole.setAttribute('flagT', new THREE.BufferAttribute(new Float32Array(n), 1));
      parts.push(pole.toNonIndexed());
    }
  }
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false)!;
}

/** Usa una sola celda de la tira de trapos como textura. */
function remapCell(g: THREE.BufferGeometry, cell: number): void {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (cell + uv.getX(i)) / BANNER_DESIGNS);
}
