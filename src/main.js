import { initAudio, loadAudio } from './audio.js';
import { renderLoop, resize } from './visual.js';
import { checkOrient, isAudio } from './utils.js';

const canvas = document.getElementById('gl');
export const gl = canvas.getContext('webgl2',{antialias:true});
if(!gl){alert('WebGL2 unavailable');}

resize(); window.addEventListener('resize',resize);
checkOrient(); window.addEventListener('resize',checkOrient);

let unlocked = false;
canvas.addEventListener('click',async()=>{
  if(!unlocked){
    unlocked = true;
    await initAudio();
  }
  const el = document.createElement('input');
  // 修复 MP3 灰色：显式后缀 + 通用 audio/*
  el.accept = 'audio/mp3,audio/m4a,audio/wav,audio/flac,audio/*,video/mp4';
  el.multiple = true;
  el.onchange = async(e)=>{
    for(const f of [...el.files]){
      if(!isAudio(f))continue;
      const buf = await f.arrayBuffer();
      // 修复无声：解码→start 不拆链，紧跟用户事件
      loadAudio(buf,f.name);
    }
  };
  el.click();
},{once:false});

window.addEventListener('dragover',e=>e.preventDefault());
window.addEventListener('drop',async(e)=>{
  e.preventDefault();
  for(const f of [...e.dataTransfer.files]){
    if(!isAudio(f))continue;
    const buf = await f.arrayBuffer();
    loadAudio(buf,f.name);
  }
});

renderLoop();
