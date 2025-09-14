export let tilt=0,lastPeak=0;
export function checkOrient(){
  const hint=document.getElementById('rotateHint');
  if(window.innerWidth>window.innerHeight&&window.innerWidth<=900){
    hint.style.display='flex';
  }else{
    hint.style.display='none';
  }
}
export function isAudio(f){
  return f.type.startsWith('audio')||
         f.type==='video/mp4'||
         /\.(mp3|m4a|wav|flac|aac|mp4)$/i.test(f.name);
}
export function autoParticle(){
  // 同之前逻辑，略
}
if(window.DeviceOrientationEvent){
  window.addEventListener('deviceorientation',e=>{
    tilt=Math.max(-1,Math.min(1,(e.gamma||0)/45));
  });
}
