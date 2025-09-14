// main.js —— 光环 + 粒子 + 拖歌 + FFT
const canvas = document.getElementById('gl');
const gl = canvas.getContext('webgl2', { antialias: true });
if (!gl) { alert('WebGL2 不支持'); }

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

// ===== 着色器 =====
const vs = `#version 300 es
in vec2 a_pos;
in float a_rand;
uniform float u_time,u_breathe;
out float v_rand;
void main(){
  float t=u_time*0.002;
  float s=0.7+0.3*cos(t+u_breathe*6.28);
  vec2 p=a_pos*s;
  gl_PointSize=6.+4.*(1.+sin(t*5.+a_rand*10.));
  gl_Position=vec4(p,0,1);
  v_rand=a_rand;
}`;
const fs = `#version 300 es
precision highp float;
in float v_rand;
out vec4 outColor;
uniform vec3 u_colA,u_colB; uniform float u_str;
void main(){
  float d=length(gl_PointCoord-vec2(0.5));
  float alpha=smoothstep(0.5,0.1,d);
  vec3 c=mix(u_colA,u_colB,v_rand);
  outColor=vec4(c*u_str,alpha);
}`;

function compile(s, type) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, s); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(sh));
  return sh;
}
const prog = gl.createProgram();
gl.attachShader(prog, compile(vs, gl.VERTEX_SHADER));
gl.attachShader(prog, compile(fs, gl.FRAGMENT_SHADER));
gl.linkProgram(prog); gl.useProgram(prog);

// ===== 粒子 =====
let particleCount = 800;
const posArr = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
  const r = Math.sqrt(Math.random()) * 0.85, a = Math.random() * Math.PI * 2;
  posArr[i * 3] = Math.cos(a) * r;
  posArr[i * 3 + 1] = Math.sin(a) * r;
  posArr[i * 3 + 2] = Math.random();
}
const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, posArr, gl.STATIC_DRAW);
const a_pos = gl.getAttribLocation(prog, 'a_pos');
const a_rand = gl.getAttribLocation(prog, 'a_rand');
gl.enableVertexAttribArray(a_pos);
gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 12, 0);
gl.enableVertexAttribArray(a_rand);
gl.vertexAttribPointer(a_rand, 1, gl.FLOAT, false, 12, 8);

// ===== 统一变量 =====
const u_time = gl.getUniformLocation(prog, 'u_time');
const u_breathe = gl.getUniformLocation(prog, 'u_breathe');
const u_str = gl.getUniformLocation(prog, 'u_str');
const u_colA = gl.getUniformLocation(prog, 'u_colA');
const u_colB = gl.getUniformLocation(prog, 'u_colB');

// ===== 音频 =====
let actx, analyser, dataArray, breathe = 1, str = 1;

async function initAudio() {
  if (actx) return;
  actx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = actx.createAnalyser();
  analyser.fftSize = 512;
  dataArray = new Uint8Array(analyser.frequencyBinCount);
}

function hslToRgb(h, s, l) {
  h /= 360;
  let r, g, b;
  if (s === 0) { r = g = b = l; } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const ht = t => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    r = ht(h + 1 / 3); g = ht(h); b = ht(h - 1 / 3);
  }
  return [r, g, b];
}

// ===== 拖歌 =====
async function loadAudio(buf, name) {
  await initAudio();
  if (actx.state === 'suspended') await actx.resume();
  const decoded = await actx.decodeAudioData(buf.slice(0));
  const src = actx.createBufferSource();
  src.buffer = decoded;
  src.connect(analyser);
  src.start(0);
  document.getElementById('hint').textContent = name || 'Playing';
}

// 拖拽事件
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  for (const f of [...e.dataTransfer.files]) {
    if (!f.type.startsWith('audio')) continue;
    const buf = await f.arrayBuffer();
    loadAudio(buf, f.name);
  }
});

// 点击选歌（移动端）
canvas.addEventListener('click', () => {
  const el = document.createElement('input');
  el.type = 'file';
  el.accept = 'audio/*';
  el.multiple = true;
  el.onchange = async (e) => {
    for (const f of [...el.files]) {
      const buf = await f.arrayBuffer();
      loadAudio(buf, f.name);
    }
  };
  el.click();
}, { once: true });

// ===== 渲染 =====
function render(t) {
  if (analyser) {
    analyser.getByteFrequencyData(dataArray);
    let sum = 0, peak = 0;
    for (const v of dataArray) { sum += v; if (v > peak) peak = v; }
    breathe = 0.7 + 0.3 * (peak / 255);
    str = 0.5 + 0.5 * (sum / dataArray.length / 255);
    // 色相随频心漂移
    const centroid = (sum / dataArray.length) / 255;
    const hue = 200 + centroid * 120;
    const colA = hslToRgb(hue, 0.7, 0.6);
    const colB = hslToRgb((hue + 140) % 360, 0.8, 0.5);
    gl.uniform3f(u_colA, colA[0], colA[1], colA[2]);
    gl.uniform3f(u_colB, colB[0], colB[1], colB[2]);
  }
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(prog);
  gl.uniform1f(u_time, t);
  gl.uniform1f(u_breathe, breathe);
  gl.uniform1f(u_str, str);
  gl.drawArrays(gl.POINTS, 0, particleCount);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
