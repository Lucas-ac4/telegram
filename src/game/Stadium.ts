import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config/gameConfig';
import { ModelBuilder, box, cylinder } from '../engine/geometry';
import { basic, curved, toon, toonVertexColors } from '../engine/materials';
import { STADIUMS, type StadiumStyle } from '../config/stadiums';
import { NATIONS } from '../config/nations';
import { nationBannersTexture, nationLedTexture, nationScreenTexture } from '../engine/nationTextures';
import {
  BANNER_DESIGNS,
  CROWD_COLS,
  cloudTexture,
  crowdTexture,
  grassDetailTexture,
  glowTexture,
  pitchTexture,
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
  /** Estilo de estadio (índice en STADIUMS) y marca de cancha de este tramo. */
  style: number;
  marks: 0 | 1 | 2;
}

/** Piezas ya construidas de un estilo de estadio (se arman la primera vez que se necesitan). */
interface StyleSet {
  style: StadiumStyle;
  pieces: THREE.InstancedMesh[];
  glowMat: THREE.MeshBasicMaterial;
  pitchMats: (THREE.MeshLambertMaterial | null)[];
  visible: boolean;
}

/**
 * Estadio infinito: tramos de 24 m que se reciclan (pool). Cada tramo pertenece a un estilo (STADIUMS):
 * el estilo de los tramos nuevos se puede cambiar en cualquier momento (`setNextStyle`) y la cancha "se
 * transforma" en otro estadio a medida que los tramos entran desde la niebla.
 * Piezas por estilo = InstancedMesh (1 draw call por pieza para todos los tramos de ese estilo).
 */
export class Stadium {
  private segments: Segment[] = [];
  private sets: (StyleSet | null)[] = STADIUMS.map(() => null);
  private ledTextures: THREE.CanvasTexture[] = [];
  private cloudMat!: THREE.MeshBasicMaterial;
  private stars!: THREE.Points;
  private disc!: THREE.Mesh;
  private discMat!: THREE.MeshBasicMaterial;
  private blimp!: THREE.Group;
  private blimpMat!: THREE.MeshBasicMaterial;
  private crowdFx = { value: 1 };
  private floodlights = false;
  private spawnStyle = 0;
  private grassDetail = grassDetailTexture();
  private pitchGeo: THREE.PlaneGeometry;

  constructor(private scene: THREE.Scene) {
    this.pitchGeo = new THREE.PlaneGeometry(PITCH_HALF * 2, L, 1, 16);
    this.pitchGeo.rotateX(-Math.PI / 2);
    this.pitchGeo.translate(0, 0, -L / 2);

    const N = CONFIG.world.segmentCount;

    for (let i = 0; i < N; i++) {
      const seg = new THREE.Group();
      const pitch = new THREE.Mesh(this.pitchGeo, undefined);
      pitch.receiveShadow = true;
      seg.add(pitch);
      seg.position.z = -i * L + L / 2;
      scene.add(seg);
      this.segments.push({ group: seg, pitch, style: 0, marks: 0 });
    }
    this.ensureSet(0);
    this.reset(0);
    this.addClouds(scene);

    // Los otros estadios se arman de a uno mientras el jugador está en el menú (sin trabar el arranque).
    let k = 1;
    const warm = () => {
      if (k < STADIUMS.length) {
        this.ensureSet(k++);
        setTimeout(warm, 500);
      }
    };
    setTimeout(warm, 1500);
  }

  private piece(geo: THREE.BufferGeometry, mat: THREE.Material, n: number): THREE.InstancedMesh {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(m);
    return m;
  }

  /** Arma las piezas de un estilo (tribunas, pista, techo, luces, público, trapos...) si todavía no existen. */
  private ensureSet(i: number): StyleSet {
    const existing = this.sets[i];
    if (existing) return existing;
    const style = STADIUMS[i];
    const N = CONFIG.world.segmentCount;
    const sides = [-1, 1] as const;
    const headY = 3.6 + style.towerH;

    const trackTex = trackTexture(style.track);
    trackTex.repeat.set(1, L / 6);
    const trackMat = toon(0xffffff, { map: trackTex });
    const outerGeo = new THREE.PlaneGeometry(TRACK_W, L, 1, 16);
    outerGeo.rotateX(-Math.PI / 2);
    const trackGeo = mergeGeometries(
      sides.map((side) => outerGeo.clone().translate(side * (PITCH_HALF + TRACK_W / 2), 0.005, -L / 2)),
      false,
    )!;

    const nation = NATIONS[style.nation];
    const away = NATIONS[style.rivals[0]];
    // Carteles LED y pantalla gigante con los colores, frases y marcador de la selección local.
    const ledTex = nationLedTexture(nation);
    ledTex.repeat.set(2, 1);
    this.ledTextures.push(ledTex);
    const ledGeos = sides.map((side) => {
      const g = new THREE.PlaneGeometry(L, 0.85, 16, 1);
      g.rotateY(side * -Math.PI / 2);
      g.translate(side * (PITCH_HALF + 0.3), 0.62, -L / 2);
      return g;
    });
    const screenGeos = sides.map((side) => {
      const g = new THREE.PlaneGeometry(5.4, 1.7);
      g.rotateY(side * -Math.PI / 2);
      g.translate(side * (STEP0 + STEPS * STEP_W - 0.04), 5.1, -11.5);
      return g;
    });
    const bannerTex = nationBannersTexture(nation);
    const bannersMat = toon(style.banners, { map: bannerTex, side: THREE.DoubleSide });
    const flagsMat = curved(new THREE.MeshLambertMaterial({ map: bannerTex, color: style.banners, side: THREE.DoubleSide }), {
      key: 'flag',
      header: 'attribute float flagT;',
      afterBegin: 'transformed.x += sin(uTime * 7.0 + position.z * 2.5 + position.y) * 0.22 * flagT;',
    });
    const glowMat = basic({
      map: glowTexture(style.glow[0], style.glow[1]),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    glowMat.visible = this.floodlights;
    const glowGeos = sides.map((side) => new THREE.PlaneGeometry(5.5, 5.5).translate(side * (TOWER_X - 0.2), headY, -1.4));
    const crowdMat = crowdCardMaterial(this.crowdFx, crowdTexture(style.crowdShirts, style.crowdScarf));

    const pieces = [
      this.piece(mergeGeometries(ledGeos, false)!, basic({ map: ledTex }), N),
      this.piece(mergeGeometries(screenGeos, false)!, basic({ map: nationScreenTexture(nation, away) }), N),
      this.piece(trackGeo, trackMat, N),
      this.piece(buildStands(style), toonVertexColors({ map: seatsTexture() }), N),
      this.piece(buildLightPanels(style), basic({ vertexColors: true }), N),
      this.piece(buildBanners(), bannersMat, N),
      this.piece(buildFlags(style.flags / 2), flagsMat, N),
      this.piece(mergeGeometries(glowGeos, false)!, glowMat, N),
      this.piece(buildCrowdCards(), crowdMat, N),
    ];
    pieces[7].renderOrder = 2;
    const set: StyleSet = { style, pieces, glowMat, pitchMats: [null, null, null], visible: true };
    this.sets[i] = set;
    this.sync();
    return set;
  }

  private pitchMat(style: number, marks: 0 | 1 | 2): THREE.MeshLambertMaterial {
    const set = this.ensureSet(style);
    let m = set.pitchMats[marks];
    if (!m) {
      const st = set.style;
      m = pitchMaterial(pitchTexture(LANES, CONFIG.lanes.width, PITCH_HALF, marks, st.grass), this.grassDetail);
      m.color.setHex(st.grassTint);
      set.pitchMats[marks] = m;
    }
    return m;
  }

  /** Estilo de los tramos que entran de ahora en adelante (el cambio se ve llegar desde la niebla). */
  setNextStyle(i: number): void {
    this.ensureSet(i);
    this.spawnStyle = i;
  }

  /** Estilo del tramo donde está el jugador (z = 0). */
  styleHere(): number {
    for (const seg of this.segments) {
      const z = seg.group.position.z;
      if (z >= 0 && z - L <= 0) return seg.style;
    }
    return this.spawnStyle;
  }

  get styleCount(): number {
    return STADIUMS.length;
  }

  /** Copia la posición de cada tramo a las instancias (los tramos de otro estilo quedan escondidos en cada pieza). */
  private sync(): void {
    const m = new THREE.Matrix4();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const setMats = (pieces: THREE.InstancedMesh[], style: number | null) => {
      for (let i = 0; i < this.segments.length; i++) {
        const seg = this.segments[i];
        const show = style === null || seg.style === style;
        const mat = show ? m.makeTranslation(0, 0, seg.group.position.z) : zero;
        for (const piece of pieces) piece.setMatrixAt(i, mat);
      }
      for (const piece of pieces) piece.instanceMatrix.needsUpdate = true;
    };
    this.sets.forEach((set, idx) => {
      if (!set) return;
      const used = this.segments.some((seg) => seg.style === idx);
      if (used) setMats(set.pieces, idx);
      if (used !== set.visible) {
        set.visible = used;
        for (const piece of set.pieces) piece.visible = used;
        if (!used) {
          setMats(set.pieces, idx);
          // El césped de un estadio que ya quedó atrás se libera (se vuelve a armar si hace falta): ahorra ~6 MB por estadio.
          set.pitchMats.forEach((m, k) => {
            m?.map?.dispose();
            m?.dispose();
            set.pitchMats[k] = null;
          });
        }
      }
    });
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

    // Dirigible publicitario que cruza el cielo muy despacio (da vida al fondo).
    this.blimp = new THREE.Group();
    const bodyMat = (this.blimpMat = new THREE.MeshBasicMaterial({ color: 0xf2f4f8, fog: false }));
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), bodyMat);
    hull.scale.set(5.2, 1.7, 1.7);
    const stripe = new THREE.Mesh(new THREE.SphereGeometry(1.02, 20, 12, 0, Math.PI * 2, 1.25, 0.5), new THREE.MeshBasicMaterial({ color: 0x2f5fb5, fog: false }));
    stripe.scale.set(5.2, 1.7, 1.7);
    const finMat = new THREE.MeshBasicMaterial({ color: 0x2f5fb5, fog: false });
    for (const r of [0, Math.PI / 2]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.9, 0.12), finMat);
      fin.position.set(-4.7, 0, 0);
      fin.rotation.x = r;
      this.blimp.add(fin);
    }
    this.blimp.add(hull, stripe);
    this.blimp.position.set(-70, 40, -220);
    this.blimp.scale.setScalar(2.2);
    scene.add(this.blimp);

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
    this.floodlights = theme.floodlights;
    for (const set of this.sets) if (set) set.glowMat.visible = theme.floodlights;
    this.blimpMat.color.setHex(theme.id === 'noche' ? 0x8f9bb8 : theme.id === 'atardecer' ? 0xf0c9a8 : 0xf2f4f8);
  }

  /** Vuelve al inicio con el estadio elegido (todos los tramos del mismo estilo). */
  reset(style = this.spawnStyle): void {
    this.spawnStyle = style;
    this.ensureSet(style);
    this.segments.forEach((seg, i) => {
      seg.group.position.z = -i * L + L / 2;
      seg.style = style;
      seg.marks = 0;
      seg.pitch.material = this.pitchMat(style, 0);
    });
    this.sync();
  }

  update(dt: number, speed: number): void {
    const dz = speed * dt;
    for (const seg of this.segments) {
      seg.group.position.z += dz;
      // Tramo que quedó detrás de la cámara → se manda al final con otra marca de cancha (y el estilo vigente).
      if (seg.group.position.z - L > 12) {
        seg.group.position.z -= L * this.segments.length;
        const r = Math.random();
        seg.marks = r < 0.55 ? 0 : r < 0.78 ? 1 : 2;
        seg.style = this.spawnStyle;
        seg.pitch.material = this.pitchMat(seg.style, seg.marks);
      }
    }
    this.sync();
    this.blimp.position.x += dt * 3;
    if (this.blimp.position.x > 90) this.blimp.position.x = -90;
    for (const t of this.ledTextures) t.offset.x = (t.offset.x + dt * 0.08) % 1;
  }
}

/** Césped: mapa de marcas + grano de hebras que se desvanece con la distancia (nítido cerca, limpio lejos). */
function pitchMaterial(map: THREE.Texture, detail: THREE.Texture): THREE.MeshLambertMaterial {
  const mat = toon(0xffffff, { map });
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    base.call(mat, shader, renderer);
    shader.uniforms.uDetail = { value: detail };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float gd = texture2D(uDetail, vMapUv * vec2(${((PITCH_HALF * 2) / 0.5).toFixed(1)}, ${(L / 0.5).toFixed(1)})).r;
        float gfade = 1.0 - smoothstep(14.0, 55.0, length(vViewPosition));
        diffuseColor.rgb *= 1.0 + (gd - 0.5) * 0.9 * gfade;`,
      );
  };
  mat.customProgramCacheKey = () => 'pitch-detail';
  return mat;
}

/** Material del público: tarjetas con recorte, salto por persona y flashes de cámara (todo en el shader). */
function crowdCardMaterial(fx: { value: number }, map: THREE.Texture): THREE.MeshLambertMaterial {
  const mat = curved(new THREE.MeshLambertMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide }), { key: 'crowdcard' });
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
function buildStands(style: StadiumStyle): THREE.BufferGeometry {
  const sectorColors = style.seats;
  const parts: THREE.BufferGeometry[] = [];
  const seated = new ModelBuilder(); // con textura de asientos (se les calcula UV)
  const plain = new ModelBuilder(); // sin textura (UV 0)
  for (const side of [-1, 1]) {
    // Muro perimetral blanco con friso.
    plain.add(boxZ(0.4, 1.0, L), style.wall, [side * WALL_X, 0.5, -L / 2]);
    plain.add(boxZ(0.42, 0.14, L), style.wallTrim, [side * WALL_X, 1.02, -L / 2]);
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
    plain.add(boxZ(0.6, 7, L), style.back, [backX, 3.5, -L / 2]);
    plain.add(boxZ(0.7, 0.3, L), style.backTrim, [backX, 7, -L / 2]);
    // Túneles de acceso (vomitorios) con marco: aparecen cada tramo.
    const tx = side * (STEP0 + 2 * STEP_W + 0.56);
    plain.add(new THREE.BoxGeometry(0.1, 1.5, 2.3), 0x090b14, [tx, 1.0 + 2 * 0.7 + 0.75, -6]);
    plain.add(new THREE.BoxGeometry(0.14, 0.14, 2.6), style.backTrim, [tx, 1.0 + 2 * 0.7 + 1.55, -6]);
    // Techo según el estilo: cercha inclinada (clásico / mundial), visera plana moderna (arena) o sin techo (popular).
    const roofX = side * (STEP0 + (STEPS * STEP_W) / 2 - 0.3);
    if (style.roof === 'truss') {
      plain.add(boxZ(STEPS * STEP_W + 1.6, 0.22, L), style.roofColor, [roofX, 7.9, -L / 2], [0, 0, side * 0.1]);
      plain.add(boxZ(0.12, 0.5, L), style.roofEdge, [side * (WALL_X + 0.25), 7.45, -L / 2]);
      for (const z of [-3, -9, -15, -21]) {
        plain.add(new THREE.BoxGeometry(STEPS * STEP_W + 1.4, 0.1, 0.1), 0x8d97a8, [roofX, 7.72, z], [0, 0, side * 0.1]);
      }
    } else if (style.roof === 'canopy') {
      plain.add(boxZ(STEPS * STEP_W + 2.6, 0.45, L), style.roofColor, [roofX - side * 0.3, 8.3, -L / 2]);
      plain.add(boxZ(0.14, 0.7, L), style.roofEdge, [side * (WALL_X - 0.9), 8.2, -L / 2]);
      for (const z of [-3, -9, -15, -21]) plain.add(cylinder(0.09, 0.09, 8, 6), 0x3a4256, [side * (WALL_X - 0.8), 4.2, z]);
    } else {
      // Sin techo: una baranda baja y vigas de iluminación al fondo.
      plain.add(boxZ(0.12, 0.5, L), style.roofEdge, [side * (WALL_X + 0.25), 1.35, -L / 2]);
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
    plain.add(cylinder(0.18, 0.25, style.towerH, 8), 0x9aa5b1, [side * TOWER_X, 3.5 + style.towerH / 2, -2]);
    plain.add(box(3.2, 1.8, 0.5, 0.1), 0x4b5563, [side * TOWER_X, 3.6 + style.towerH, -2], [0, -side * 0.5, 0]);
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

function buildLightPanels(style: StadiumStyle): THREE.BufferGeometry {
  const headY = 3.6 + style.towerH;
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const b = new ModelBuilder();
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 4; c++) b.add(new THREE.BoxGeometry(0.62, 0.62, 0.1), style.lightPanel, [(c - 1.5) * 0.72, 0.36 - r * 0.72, 0.27]);
    }
    const g = b.build();
    // Mismo giro y posición que el cabezal de la torre.
    g.rotateY(-side * 0.5);
    g.translate(side * TOWER_X, headY, -2);
    parts.push(g);
    // Tiras de neón (arena): borde de la visera, tope del muro y pared del fondo.
    if (style.neon) {
      const n = new ModelBuilder();
      const [c1, c2] = style.neon;
      const backX = side * (STEP0 + STEPS * STEP_W + 0.3);
      n.add(boxZ(0.16, 0.16, L), c1, [side * (WALL_X - 0.9), 7.9, -L / 2]);
      n.add(boxZ(0.2, 0.14, L), c2, [side * (WALL_X - 0.22), 1.1, -L / 2]);
      n.add(boxZ(0.16, 0.2, L), c1, [backX - side * 0.32, 6.6, -L / 2]);
      n.add(boxZ(0.16, 0.14, L), c2, [backX - side * 0.32, 4.2, -L / 2]);
      parts.push(n.build());
    }
  }
  return mergeGeometries(parts, false)!;
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

const FLAG_SPOTS: [number, number][] = [[2, -6], [4, -17], [3, -11], [5, -22], [1, -2], [4, -9]];

/** Banderas en mástiles dentro de la hinchada; `flagT` = distancia al mástil (para el flameo). */
function buildFlags(perSide: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  let k = 1;
  for (const side of [-1, 1]) {
    for (const [step, z] of FLAG_SPOTS.slice(0, perSide)) {
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
