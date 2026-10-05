import * as THREE from 'three';
import { CONFIG } from '../config/gameConfig';

/**
 * Materiales con look "cartoon" (toon shading + contorno negro) y
 * mundo curvo estilo Subway Surfers, aplicado a TODOS los materiales.
 */

/** Uniforms compartidos por todos los shaders. */
export const sharedUniforms = {
  uCurve: { value: CONFIG.world.curvature },
  uTime: { value: 0 },
  /** Luz de borde (rim light): da volumen a personajes y objetos. Se tiñe según el ambiente. */
  uRimColor: { value: new THREE.Color(0xfff2d8) },
  uRimStrength: { value: 0.35 },
};

/** Gradiente de 3 tonos para el toon shading. */
const gradientMap = (() => {
  const data = new Uint8Array([120, 192, 255]);
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

interface VertexPatch {
  key: string;
  uniforms?: Record<string, THREE.IUniform>;
  /** Código GLSL después de `begin_vertex` (puede modificar `transformed`). */
  afterBegin?: string;
  /** Declaraciones extra (atributos) al principio del vertex shader. */
  header?: string;
}

/** Inyecta la curvatura del mundo (y parches opcionales) en un material de Three. */
export function curved<T extends THREE.Material>(material: T, patch?: VertexPatch): T {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCurve = sharedUniforms.uCurve;
    shader.uniforms.uTime = sharedUniforms.uTime;
    Object.assign(shader.uniforms, patch?.uniforms);
    if (material.userData.rim) {
      shader.uniforms.uRimColor = sharedUniforms.uRimColor;
      shader.uniforms.uRimStrength = sharedUniforms.uRimStrength;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;')
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
          float rimF = 1.0 - max(dot(normalize(vNormal), normalize(vViewPosition)), 0.0);
          gl_FragColor.rgb += uRimColor * smoothstep(0.6, 1.0, rimF) * uRimStrength;`,
        );
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uCurve;\nuniform float uTime;\n' + uniformDecls(patch) + (patch?.header ?? ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (patch?.afterBegin ?? ''))
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        // Mundo curvo: lo lejano "cae" bajo el horizonte.
        mvPosition.y -= mvPosition.z * mvPosition.z * uCurve;
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  material.customProgramCacheKey = () => 'curved-' + (patch?.key ?? '') + (material.userData.rim ? '-rim' : '');
  return material;
}

function uniformDecls(patch?: VertexPatch): string {
  if (!patch?.uniforms) return '';
  return Object.keys(patch.uniforms)
    .map((name) => `uniform float ${name};`)
    .join('\n');
}

export function toon(color: THREE.ColorRepresentation, opts: THREE.MeshToonMaterialParameters = {}): THREE.MeshToonMaterial {
  return curved(new THREE.MeshToonMaterial({ color, gradientMap, ...opts }));
}

/** Toon con luz de borde (personajes, obstáculos, monedas). */
export function toonRim(color: THREE.ColorRepresentation, opts: THREE.MeshToonMaterialParameters = {}): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ color, gradientMap, ...opts });
  m.userData.rim = true;
  return curved(m);
}

/** Toon que toma el color de cada vértice (para geometrías fusionadas). */
export function toonVertexColors(opts: THREE.MeshToonMaterialParameters = {}, rim = false): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap, ...opts });
  m.userData.rim = rim;
  return curved(m);
}

export function basic(opts: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial {
  return curved(new THREE.MeshBasicMaterial(opts));
}

/** Contorno negro por "casco invertido": se infla la malla sobre su normal y se dibuja la cara de atrás. */
export function outlineMaterial(thickness = 0.035): THREE.MeshBasicMaterial {
  return curved(new THREE.MeshBasicMaterial({ color: 0x1a1030, side: THREE.BackSide }), {
    key: 'outline-' + thickness,
    uniforms: { uOutline: { value: thickness } },
    afterBegin: 'transformed += normal * uOutline;',
  });
}

const sharedOutline = outlineMaterial();
const thinOutline = outlineMaterial(0.022);

/** Agrega el contorno a una malla (como hijo, comparte geometría). */
export function withOutline<T extends THREE.Mesh>(mesh: T, thin = false): T {
  const outline = new THREE.Mesh(mesh.geometry, thin ? thinOutline : sharedOutline);
  outline.name = 'outline';
  mesh.add(outline);
  return mesh;
}
