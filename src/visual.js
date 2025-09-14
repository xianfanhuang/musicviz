import { analyser, dataArray } from './audio.js';
import { tilt, autoParticle, lastPeak } from './utils.js';

let breathe=1,str=1,particleCount=900;
export function resize(){
  const dpr=Math.min(window.devicePixelRatio||1,2);
  // 已在 main 调用
}

/* WebGL 初始化（同之前，略） */
const prog=/* 编译链 */;
const buf=/* 粒子缓冲 */;
const u_time=gl.getUniformLocation(prog,'u_time');
const u_breathe=gl.getUniformLocation(prog,'u_breathe');
const u_str=gl.getUniformLocation(prog,'u_str');
const u_colA=gl.getUniformLocation(prog,'u_colA');
const u_colB=gl.getUniformLocation(prog,'u_colB');

function hslToRgb(h,s,l){/* 同前 */}

export function renderLoop(){
  function render(t){
    autoParticle(); // 性能自适应
    if(analyser){
      analyser.getByteFrequencyData(dataArray);
      let sum=0,peak=0;
      for(const v of dataArray){sum+=v;if(v>peak)peak=v;}
      breathe=0.7+0.3*(peak/255);
      str=0.5+0.5*(sum/dataArray.length/255);
      const centroid=(sum/dataArray.length)/255;
      const hue=200+centroid*120;
      const colA=hslToRgb(hue,0.7,0.6);
      const colB=hslToRgb((hue+140)%360,0.8,0.5);
      gl.uniform3f(u_colA,colA[0],colA[1],colA[2]);
      gl.uniform3f(u_colB,colB[0],colB[1],colB[2]);

      // 节拍闪光
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
}
// ===== 情绪色温：低频暖 · 高频冷 =====
let colorTemp = 0.5; // 0=暖 1=冷

/**
 * 根据频谱重心计算色温
 * 重心低 → 暖橙，重心高 → 冷青
 */
function updateColorTemp(){
  if(!analyser)return;
  const sum = dataArray.reduce((a,v)=>a+v,0);
  const centroid = sum / dataArray.length / 255; // 0-1
  colorTemp = Math.max(0,Math.min(1,centroid)); // 锁 0-1
}

/**
 * 色温 → 色相映射
 * 0(暖) = 20°橙, 1(冷) = 220°青
 */
function tempToHue(temp){
  return 20 + temp * 200; // 20→220
}

/**
 * 情绪色温 → 最终颜色
 * 返回 [r,g,b] 供 WebGL 使用
 */
function emotionColor(temp){
  const hue = tempToHue(temp);
  const sat = 0.7 + temp * 0.1; // 冷色稍艳
  const light = 0.6 + temp * 0.1;
  return hslToRgb(hue,sat,light);
}

