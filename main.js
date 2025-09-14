// 最简 WebGL2 光环 + 音频上下文骨架
const canvas=document.getElementById('gl');
const gl=canvas.getContext('webgl2',{antialias:true});
if(!gl){alert('WebGL2 不支持');}

// 适配屏幕
function resize(){
  const dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.floor(canvas.clientWidth*dpr);
  canvas.height=Math.floor(canvas.clientHeight*dpr);
  gl.viewport(0,0,canvas.width,canvas.height);
}
window.addEventListener('resize',resize);
resize();

// 极简单元着色器：光环呼吸
const vs=`#version 300 es
in vec2 a_pos;
uniform float u_time,u_breathe;
void main(){
  float s=0.7+0.3*sin(u_time*0.001+u_breathe*6.28);
  gl_Position=vec4(a_pos*s,0,1);
}`;
const fs=`#version 300 es
precision highp float;
out vec4 outColor;
uniform float u_str;
void main(){
  vec2 uv=gl_FragCoord.xy/vec2(390,844);
  float d=length(uv-0.5);
  float ring=smoothstep(0.35,0.33,d)*smoothstep(0.25,0.27,d);
  outColor=vec4(vec3(0,0.7,1)*u_str,ring);
}`;

// 编译链
function compile(s,type){
  const sh=gl.createShader(type);
  gl.shaderSource(sh,s);gl.compileShader(sh);
  if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(sh));
  return sh;
}
const prog=gl.createProgram();
gl.attachShader(prog,compile(vs,gl.VERTEX_SHADER));
gl.attachShader(prog,compile(fs,gl.FRAGMENT_SHADER));
gl.linkProgram(prog);
gl.useProgram(prog);

// 光环几何
const verts=new Float32Array(1024);
for(let i=0;i<1024;i++){
  const a=i/512*Math.PI*2;
  verts[i*2]=Math.cos(a)*0.9;
  verts[i*2+1]=Math.sin(a)*0.9;
}
const buf=gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER,buf);
gl.bufferData(gl.ARRAY_BUFFER,verts,gl.STATIC_DRAW);
const loc=gl.getAttribLocation(prog,'a_pos');
gl.enableVertexAttribArray(loc);
gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);

// 统一变量
const u_time=gl.getUniformLocation(prog,'u_time');
const u_breathe=gl.getUniformLocation(prog,'u_breathe');
const u_str=gl.getUniformLocation(prog,'u_str');

// 音频全局
let actx,analyser,source,bufferLength,dataArray,breathe=1,str=1;

// 初始化音频（必须用户手势）
canvas.addEventListener('click',async()=>{
  if(actx)return;
  document.getElementById('hint').remove();
  actx=new (window.AudioContext||window.webkitAudioContext)();
  analyser=actx.createAnalyser();
  analyser.fftSize=512;
  bufferLength=analyser.frequencyBinCount;
  dataArray=new Uint8Array(bufferLength);
  // 先放一段 1 秒粉红噪声当占位
  const noiseBuffer=actx.createBuffer(1,actx.sampleRate,actx.sampleRate);
  const data=noiseBuffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  source=actx.createBufferSource();
  source.buffer=noiseBuffer;
  source.loop=true;
  source.connect(analyser);
  analyser.connect(actx.destination);
  source.start();
},{once:true});

// 渲染循环
function render(t){
  if(analyser){
    analyser.getByteFrequencyData(dataArray);
    let sum=0,peak=0;
    for(const v of dataArray){sum+=v;if(v>peak)peak=v;}
    breathe=0.7+0.3*(peak/255);
    str=0.5+0.5*(sum/bufferLength/255);
  }
  gl.clearColor(0,0,0,1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(prog);
  gl.uniform1f(u_time,t);
  gl.uniform1f(u_breathe,breathe);
  gl.uniform1f(u_str,str);
  gl.drawArrays(gl.LINE_LOOP,0,512);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
