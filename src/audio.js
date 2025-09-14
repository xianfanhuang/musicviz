let actx,analyser,dataArray;
export async function initAudio(){
  if(actx)return;
  actx = new(window.AudioContext||window.webkitAudioContext)();
  analyser = actx.createAnalyser();
  analyser.fftSize = 512;
  dataArray = new Uint8Array(analyser.frequencyBinCount);
  // 静音探测脉冲
  const osc=actx.createOscillator(),g=actx.createGain();
  osc.frequency.value=800;g.gain.value=0.0003;
  osc.connect(g);g.connect(actx.destination);
  osc.start();osc.stop(actx.currentTime+0.001);
  analyser.connect(actx.destination);
}
export async function loadAudio(buf,name){
  await initAudio();
  if(actx.state==='suspended')await actx.resume();
  const decoded=await actx.decodeAudioData(buf.slice(0));
  const src=actx.createBufferSource();
  src.buffer=decoded;
  src.connect(analyser);
  src.start(0); // ← 不拆链，立即出声
  document.getElementById('hint').textContent=name||'Playing';
}
export { analyser, dataArray };
