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
