import re

# 读取文件
with open('./前端项目/Sonori'Ai.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 替换Puter SDK为OpenAI SDK
old_sdk = '''<script>
\t(function() {
\t\tconst script = document.createElement('script');
\t\tscript.async = true;
\t\tscript.src = 'https://js.puter.com/v2/';
\t\tscript.onerror = function() {
\t\t\tconsole.warn('[Sonoria] Puter SDK加载失败，使用本地模式');
\t\t\twindow.puterUnavailable = true;
\t\t};
\t\tdocument.head.appendChild(script);
\t})();
</script>'''

new_sdk = '\t<script src="https://cdn.jsdelivr.net/npm/openai@4.28.0/dist/openai.min.js"></script>'

content = content.replace(old_sdk, new_sdk)

# 替换AI Engine
old_engine = '''// ============================================================
// Puter AI Engine
// ============================================================
class PuterAIEngine{
constructor(){this.isAvailable=false;this.checkAvailability()}
checkAvailability(){
if(typeof puter!=='undefined'){this.isAvailable=true;S.puterAvailable=true;showToast(t('puterConnected'),'ai')}
else{this.isAvailable=false;S.puterAvailable=false;showToast(t('puterOffline'),'error')}
}
getSystemPrompt(){
const track=S.playlist[S.trackIdx];
const trackInfo=track?`${t('nowPlaying',{name:track.name})}`:'No track playing';
const audioStats=`Realtime: energy=${S.energy.toFixed(2)}, bass=${S.bassEnergy.toFixed(2)}, mid=${S.midEnergy.toFixed(2)}, treble=${S.trebleEnergy.toFixed(2)}, BPM≈${audioAnalyzer.features.bpm}`;
const modes=Object.values(MODES).map(m=>m.name()).join(' / ');
const langInstruction=lang==='zh'?'Respond in Chinese, concise <80 chars.':'Respond in English, concise <80 chars.';
return`You are Sonoria AI, a music visualization assistant.
${trackInfo}
${audioStats}
Available modes: ${modes}
${langInstruction}
Support commands: switch [mode], analyze mood, pause/play, next/prev, zen mode.`;
}
async chat(message){
if(!this.isAvailable)return this.offlineFallback(message);
try{
const messages=[{role:'system',content:this.getSystemPrompt()},...S.aiConversation,{role:'user',content:message}];
const response=await puter.ai.chat(messages);
S.aiConversation.push({role:'user',content:message});
S.aiConversation.push({role:'assistant',content:response.content||response.message?.content||''});
const text=response.content||response.message?.content||'';
await this.executeCommand(text);
return text;
}catch(e){
console.error('Puter AI error:',e);
return t('aiCallFailed')+'
'+this.offlineFallback(message);
}
}
async executeCommand(resp){
const l=resp.toLowerCase();
// Mode switching commands (bilingual)
const modeMap={abyss:['abyss','深海'],cyber:['cyber','赛博'],aurora:['aurora','极光'],quantum:['quantum','量子'],magma:['magma','岩浆'],zen:['zen','禅']};
for(let[id,keys]of Object.entries(modeMap)){if(keys.some(k=>l.includes(k))){switchMode(id);break}}
if(l.includes('pause')||l.includes('暂停')||l.includes('stop')||l.includes('停止')){if(S.playing)engine.togglePlay()}
if(l.includes('play')||l.includes('播放')){if(!S.playing)engine.togglePlay()}
if(l.includes('next')||l.includes('下一首')||l.includes('skip'))engine.playNext();
if(l.includes('prev')||l.includes('上一首'))engine.playPrev();
if(l.includes('zen')||l.includes('禅')){if(!ui.shell.classList.contains('zen'))enterZenMode()}
}
offlineFallback(cmd){
const l=cmd.toLowerCase();
if(l.includes('mood')||l.includes('情绪')||l.includes('心情')||l.includes('feel')){
const avgE=S.energy,bassR=S.bassEnergy/(S.energy+.01);
if(avgE>.7&&bassR>.6)return t('moodIntense');
if(avgE>.5)return t('moodBright');
if(avgE<.3)return t('moodCalm');
return t('moodNeutral');
}
const modeMap={abyss:['abyss','深海'],cyber:['cyber','赛博'],aurora:['aurora','极光'],quantum:['quantum','量子'],magma:['magma','岩浆'],zen:['zen','禅']};
for(let[id,keys]of Object.entries(modeMap)){
if(keys.some(k=>l.includes(k))){switchMode(id);return t('moodSwitched',{name:MODES[id].name()})}
}
if(l.includes('theme')||l.includes('主题')||l.includes('切换')){randomTheme();return t('themeName',{name:MODES[S.currentMode].name()})}
return t('offlineHelp');
}
}
const aiEngine=new PuterAIEngine();'''

new_engine = '''// ============================================================
// GitCode Qwen AI Engine (硬编码API Key)
// ============================================================
class GitCodeQwenEngine{
constructor(){this.isAvailable=true;this.client=null;this.apiKey='-XXP9UKXxTwfarhDyqEYChST';this.initClient()}
async initClient(){
if(!this.client){
this.client=new OpenAI({
baseURL:"https://api-ai.gitcode.com/v1",
apiKey:this.apiKey,
dangerouslyAllowBrowser:true
});
}
}
async checkAvailability(){
await this.initClient();
S.puterAvailable=true;
}
getSystemPrompt(){
const track=S.playlist[S.trackIdx];
const trackInfo=track?`${t('nowPlaying',{name:track.name})}`:'No track playing';
const audioStats=`Realtime: energy=${S.energy.toFixed(2)}, bass=${S.bassEnergy.toFixed(2)}, mid=${S.midEnergy.toFixed(2)}, treble=${S.trebleEnergy.toFixed(2)}, BPM≈${audioAnalyzer.features.bpm}`;
const modes=Object.values(MODES).map(m=>m.name()).join(' / ');
const langInstruction=lang==='zh'?'用中文回复，简洁，不超过80个字符。':'Respond in English, concise, max 80 chars.';
return`你是Sonoria AI，一个音乐可视化助手。
${trackInfo}
${audioStats}
可用模式: ${modes}
${langInstruction}
支持命令: 切换[模式], 分析情绪, 暂停/播放, 下一首/上一首, 禅模式。`;
}
async chat(message){
try{
await this.initClient();
const messages=[{role:"system",content:this.getSystemPrompt()},...S.aiConversation,{role:"user",content:message}];
const response=await this.client.chat.completions.create({
model:"Qwen/Qwen3.5-35B-A3B",
messages:messages,
max_tokens:200,
temperature:0.7
});
const text=response.choices[0]?.message?.content||"";
S.aiConversation.push({role:"user",content:message});
S.aiConversation.push({role:"assistant",content:text});
await this.executeCommand(text);
return text;
}catch(e){
console.error('GitCode AI error:',e);
return t('aiCallFailed')+'
'+this.offlineFallback(message);
}
}
async executeCommand(resp){
const l=resp.toLowerCase();
// Mode switching commands (bilingual)
const modeMap={abyss:['abyss','深海'],cyber:['cyber','赛博'],aurora:['aurora','极光'],quantum:['quantum','量子'],magma:['magma','岩浆'],zen:['zen','禅']};
for(let[id,keys]of Object.entries(modeMap)){if(keys.some(k=>l.includes(k))){switchMode(id);break}}
if(l.includes('pause')||l.includes('暂停')||l.includes('stop')||l.includes('停止')){if(S.playing)engine.togglePlay()}
if(l.includes('play')||l.includes('播放')){if(!S.playing)engine.togglePlay()}
if(l.includes('next')||l.includes('下一首')||l.includes('skip'))engine.playNext();
if(l.includes('prev')||l.includes('上一首'))engine.playPrev();
if(l.includes('zen')||l.includes('禅')){if(!ui.shell.classList.contains('zen'))enterZenMode()}
}
offlineFallback(cmd){
const l=cmd.toLowerCase();
if(l.includes('mood')||l.includes('情绪')||l.includes('心情')||l.includes('feel')){
const avgE=S.energy,bassR=S.bassEnergy/(S.energy+.01);
if(avgE>.7&&bassR>.6)return t('moodIntense');
if(avgE>.5)return t('moodBright');
if(avgE<.3)return t('moodCalm');
return t('moodNeutral');
}
const modeMap={abyss:['abyss','深海'],cyber:['cyber','赛博'],aurora:['aurora','极光'],quantum:['quantum','量子'],magma:['magma','岩浆'],zen:['zen','禅']};
for(let[id,keys]of Object.entries(modeMap)){
if(keys.some(k=>l.includes(k))){switchMode(id);return t('moodSwitched',{name:MODES[id].name()})}
}
if(l.includes('theme')||l.includes('主题')||l.includes('切换')){randomTheme();return t('themeName',{name:MODES[S.currentMode].name()})}
return t('offlineHelp');
}
}
const aiEngine=new GitCodeQwenEngine();'''

content = content.replace(old_engine, new_engine)

# 更新i18n
content = content.replace("puterConnected:'GitHub AI 已连接',", "gitcodeConnected:'GitCode AI 已连接',")
content = content.replace("puterOffline:'GitHub AI 不可用，已切换到离线模式',", "gitcodeOffline:'GitCode AI 不可用，已切换到离线模式',")
content = content.replace("aiWelcome:'我是 Sonoria AI，由 GitHub Models 驱动。", "aiWelcome:'我是 Sonoria AI，由 GitCode 千问模型驱动。")
content = content.replace("powered by GitHub Models", "powered by GitCode Qwen")

# 写回文件
with open('./前端项目/Sonori'Ai.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("替换完成！")
