import * as THREE from 'three';

/**
 * Post-proceso liviano solo para el nivel HIGH:
 *  1) la escena se dibuja en un buffer HDR con antialiasing (MSAA),
 *  2) se extraen las zonas muy brillantes (sol, reflectores, monedas, chispas) a media resolución,
 *  3) se desenfocan a 1/4 de resolución (2 pasadas separables) = bloom suave,
 *  4) un último paso suma el bloom, aplica color grading (contraste / saturación) y el tone mapping.
 * Si el dispositivo no soporta buffers de punto flotante, `PostFX.supported()` da false y no se usa.
 */

const FULL_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRIGHT_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(uThreshold, uThreshold + 0.6, l);
  gl_FragColor = vec4(c * k, 1.0);
}`;

const BLUR_FRAG = /* glsl */ `
uniform sampler2D tMap;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 s = texture2D(tMap, vUv).rgb * 0.2270270270;
  s += (texture2D(tMap, vUv + uDir * 1.3846153846).rgb + texture2D(tMap, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
  s += (texture2D(tMap, vUv + uDir * 3.2307692308).rgb + texture2D(tMap, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
  gl_FragColor = vec4(s, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uSaturation;
uniform float uContrast;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloom;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);
  c = (c - 0.18) * uContrast + 0.18;
  gl_FragColor = vec4(max(c, 0.0), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class PostFX {
  private scene: THREE.WebGLRenderTarget;
  private bright: THREE.WebGLRenderTarget;
  private blurA: THREE.WebGLRenderTarget;
  private blurB: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh;
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private brightMat: THREE.ShaderMaterial;
  private blurMat: THREE.ShaderMaterial;
  private compMat: THREE.ShaderMaterial;
  private fsScene = new THREE.Scene();

  /** ¿El dispositivo puede dibujar en buffers HDR? */
  static supported(renderer: THREE.WebGLRenderer): boolean {
    return renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  }

  constructor() {
    const rt = (samples = 0) =>
      new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples, depthBuffer: samples > 0, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.scene = rt(4);
    this.bright = rt();
    this.blurA = rt();
    this.blurB = rt();
    const mk = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({ vertexShader: FULL_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.brightMat = mk(BRIGHT_FRAG, { tScene: { value: null }, uThreshold: { value: 0.95 } });
    this.blurMat = mk(BLUR_FRAG, { tMap: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.compMat = mk(COMPOSITE_FRAG, {
      tScene: { value: null },
      tBloom: { value: null },
      uBloom: { value: 0.38 },
      uSaturation: { value: 1.1 },
      uContrast: { value: 1.06 },
    });
    // Un solo triángulo que cubre la pantalla.
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.quad = new THREE.Mesh(geo, this.brightMat);
    this.quad.frustumCulled = false;
    this.fsScene.add(this.quad);
  }

  /** Ajustes por tema (el de noche brilla más). */
  tune(bloom: number, saturation: number, contrast: number, threshold = 0.95): void {
    this.compMat.uniforms.uBloom.value = bloom;
    this.compMat.uniforms.uSaturation.value = saturation;
    this.compMat.uniforms.uContrast.value = contrast;
    this.brightMat.uniforms.uThreshold.value = threshold;
  }

  setSize(w: number, h: number): void {
    this.scene.setSize(w, h);
    this.bright.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1));
    this.blurA.setSize(Math.max(2, w >> 2), Math.max(2, h >> 2));
    this.blurB.setSize(Math.max(2, w >> 2), Math.max(2, h >> 2));
  }

  private pass(renderer: THREE.WebGLRenderer, mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null): void {
    this.quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(this.fsScene, this.cam);
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    renderer.setRenderTarget(this.scene);
    renderer.render(scene, camera);

    this.brightMat.uniforms.tScene.value = this.scene.texture;
    this.pass(renderer, this.brightMat, this.bright);

    const w = this.blurA.width;
    const h = this.blurA.height;
    this.blurMat.uniforms.tMap.value = this.bright.texture;
    this.blurMat.uniforms.uDir.value.set(1 / w, 0);
    this.pass(renderer, this.blurMat, this.blurA);
    this.blurMat.uniforms.tMap.value = this.blurA.texture;
    this.blurMat.uniforms.uDir.value.set(0, 1 / h);
    this.pass(renderer, this.blurMat, this.blurB);

    this.compMat.uniforms.tScene.value = this.scene.texture;
    this.compMat.uniforms.tBloom.value = this.blurB.texture;
    this.pass(renderer, this.compMat, null);
  }

  dispose(): void {
    for (const t of [this.scene, this.bright, this.blurA, this.blurB]) t.dispose();
  }
}
