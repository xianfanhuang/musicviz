// main.js 全修复合并版（2025-09-14）
const canvas = document.getElementById('gl');
const gl = canvas.getContext('webgl2',{antialias:true});
if(!gl){alert('WebGL2 unavailable');}

/* ========== 基础封装 ========== */
const dpr = Math.min(window.devicePixelRatio||1,2);
function resize(){
  canvas.width  = Math.floor(canvas.clientWidth*dpr);
  canvas.height = Math.floor(canvas.clientHeight*dpr);
  gl.viewport(0,0,canvas.width,canvas.height);
}
window.addEventListener('resize',resize);
resize();

/* ========== 性能自适应 ========== */
let particleCount = 900, fps=60,lastTime=0,fc=0;
function autoParticle(){
  if(fc%60!==0)return;
  const currFps = 60*1000/(performance.now()-lastTime);
  if(currFps<45&&particleCount>400)particleCount*=0.8;
  if(currFps>58&&particleCount<1400)particleCount*=1.1;
  rebuildParticles(Math.round(particleCount));
}
function rebuildParticles(n){
  particleCount=n;
  const arr=new Float32Array(n*3);
  for(let i=0;i<n;i++){
    const r=Math.sqrt(Math.random())*0.85,a=Math.random()*Math.PI*2;
    arr[i*3]=Math.cos(a)*r;
    arr[i*3+1]=Math.sin(a)*r*(canvas.height/canvas.width);
    arr[i*3+2]=Math.random();
  }
  gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,arr,gl.STATIC_DRAW);
}

/* ========== 陀螺仪 ========== */
let tilt=0;
if(window.DeviceOrientationEvent){
  window.addEventListener('deviceorientation',e=>{
    tilt=Math.max(-1,Math.min(1,(e.gamma||0)/45));
  });
}

/* ========== WebGL 资源 ========== */
const vs=`#version 300 es
in vec2 a_pos; in float a_rand;
uniform float u_time,u_breathe; out float v_rand;
void main(){
  float t=u_time*0.002;
  float s=0.7+0.3*cos(t+u_breathe*6.28)+tilt*0.08;
  vec2 p=a_pos*s;
  gl_PointSize=6.+4.*(1.+sin(t*5.+a_rand*10.));
  gl_Position=vec4(p,0,1);
  v_rand=a_rand;
}`;
const fs=`#version 300 es
precision highp float;
in float v_rand; out vec4 outColor;
uniform vec3 u_colA,u_colB; uniform float u_str;
void main(){
  float d=length(gl_PointCoord-vec2(0.5));
  float alpha=smoothstep(0.5,0.1,d);
  vec3 c=mix(u_colA,u_colB,v_rand);
  outColor=vec4(c*u_str,alpha);
}`;
function compile(s,t){
  const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);
  if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(sh));return sh;
}
const prog=gl.createProgram();
gl.attachShader(prog,compile(vs,gl.VERTEX_SHADER));
gl.attachShader(prog,compile(fs,gl.FRAGMENT_SHADER));
gl.linkProgram(prog);gl.useProgram(prog);

const buf=gl.createBuffer();
rebuildParticles(particleCount);
const a_pos=gl.getAttribLocation(prog,'a_pos');
const a_rand=gl.getAttribLocation(prog,'a_rand');
gl.enableVertexAttribArray(a_pos);
gl.vertexAttribPointer(a_pos,2,gl.FLOAT,false,12,0);
gl.enableVertexAttribArray(a_rand);
gl.vertexAttribPointer(a_rand,1,gl.FLOAT,false,12,8);

const u_time=gl.getUniformLocation(prog,'u_time');
const u_breathe=gl.getUniformLocation(prog,'u_breathe');
const u_str=gl.getUniformLocation(prog,'u_str');
const u_colA=gl.getUniformLocation(prog,'u_colA');
const u_colB=gl.getUniformLocation(prog,'u_colB');

/* ========== 音频上下文 ========== */
let actx,analyser,dataArray,breathe=1,str=1;
async function initAudio(){
  if(actx)return;
  actx=new(window.AudioContext||window.webkitAudioContext)();
  analyser=actx.createAnalyser();
  analyser.fftSize=512;dataArray=new Uint8Array(analyser.frequencyBinCount);
  // 静音探测脉冲
  const osc=actx.createOscillator(),g=actx.createGain();
  osc.frequency.value=1;g.gain.value=0.001;
  osc.connect(g);g.connect(actx.destination);
  osc.start();osc.stop(actx.currentTime+0.1);
  analyser.connect(actx.destination);
}

/* ========== 颜色 ========== */
function hslToRgb(h,s,l){
  h/=360;let r,g,b;if(s===0){r=g=b=l;}else{
    const q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q,ht=t=>{
      if(t<0)t+=1;if(t>1)t-=1;
      if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;
      if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;
    };r=ht(h+1/3);g=ht(h);b=ht(h-1/3);
  }return[r,g,b];
}

/* ========== 拖歌 + 格式白名单 ========== */
function isAudio(f){
  return f.type.startsWith('audio')||
         f.type==='video/mp4'||
         /\.(mp3|m4a|wav|flac|aac|mp4)$/i.test(f.name);
}
async function loadAudio(buf,name){
  await initAudio();
  if(actx.state==='suspended')await actx.resume();
  const decoded=await actx.decodeAudioData(buf.slice(0));
  const src=actx.createBufferSource();
  src.buffer=decoded;src.connect(analyser);
  src.start(0);document.getElementById('hint').textContent=name||'Playing';
}
window.addEventListener('dragover',e=>e.preventDefault());
window.addEventListener('drop',async(e)=>{
  e.preventDefault();
  for(const f of [...e.dataTransfer.files]){
    if(!isAudio(f))continue;
    const buf=await f.arrayBuffer();loadAudio(buf,f.name);
  }
});

/* ========== 空状态 + 横屏锁 ========== */
const hintBox=document.getElementById('hint');
const rotateHint=document.getElementById('rotateHint');
function checkOrient(){
  if(window.innerWidth>window.innerHeight&&window.innerWidth<=900){
    rotateHint.style.display='flex';
  }else{
    rotateHint.style.display='none';
  }
}
window.addEventListener('resize',checkOrient);checkOrient();
hintBox.innerHTML='点击屏幕选歌<br><small>MP3 请重命名 .m4a</small>';

/* ========== 点击解锁 + 选歌 ========== */
let unlocked=false;
canvas.addEventListener('click',async()=>{
  if(!unlocked){
    unlocked=true;await initAudio();
    if(actx.state==='suspended')await actx.resume();
    const osc=actx.createOscillator(),g=actx.createGain();
    osc.frequency.value=800;g.gain.value=0.0003;
    osc.connect(g);g.connect(actx.destination);
    osc.start();osc.stop(actx.currentTime+0.001);
  }
  const el=document.createElement('input');
  el.type='file';el.accept = 'audio/mp3,audio/m4a,audio/wav,audio/flac,audio/*,video/mp4';
  el.multiple=true;
  el.onchange=async(e)=>{
    for(const f of [...el.files]){
      if(!isAudio(f))continue;
      const buf=await f.arrayBuffer();loadAudio(buf,f.name);
    }
  };el.click();
},{once:false});

/* ========== 节拍闪光 ========== */
let lastPeak=0;
function render(t){
  // 性能计数
  if(fc===0)lastTime=performance.now();fc++;
  autoParticle();

  if(analyser){
    analyser.getByteFrequencyData(dataArray);
    let sum=0,peak=0;
    for(const v of dataArray){sum+=v;if(v>peak)peak=v;}
    breathe=0.7+0.3*(peak/255);
    str=0.5+0.5*(sum/dataArray.length/255);
    const centroid=(sum/dataArray.length)/255;
    const hue=(200+centroid*120)%360;
    const colA=hslToRgb(hue,0.7,0.6);
    const colB=hslToRgb((hue+140)%360,0.8,0.5);
    gl.uniform3f(u_colA,colA[0],colA[1],colA[2]);
    gl.uniform3f(u_colB,colB[0],colB[1],colB[2]);

    // 闪光触发
    const beat=peak>200&&peak>lastPeak+30;
    if(beat){
      document.documentElement.style.setProperty('--flash','1');
      setTimeout(()=>document.documentElement.style.setProperty('--flash','0'),100);
    }
    lastPeak=peak;
  }
  gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(prog);
  gl.uniform1f(u_time,t);
  gl.uniform1f(u_breathe,breathe);
  gl.uniform1f(u_str,str);
  gl.drawArrays(gl.POINTS,0,particleCount);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
