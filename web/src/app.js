import {PlatformViewer} from './viewer.js';
import {parts,dofs} from './config.js';

const $=selector=>document.querySelector(selector);
const all=selector=>[...document.querySelectorAll(selector)];
let viewer,selected=null,toastTimer;
const visibility=Object.fromEntries(Object.keys(parts).map(key=>[key,true]));
function toast(text){
  $('#toast').textContent=text;$('#toast').classList.add('visible');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2600);
}
function openDrawer(name){
  document.body.classList.toggle('show-parts',name==='parts');
  document.body.classList.toggle('show-settings',name==='settings');
  $('#panel-backdrop').hidden=!name;
  $('#parts-button').setAttribute('aria-expanded',String(name==='parts'));
  $('#settings-button').setAttribute('aria-expanded',String(name==='settings'));
}
$('#parts-button').addEventListener('click',()=>openDrawer(document.body.classList.contains('show-parts')?null:'parts'));
$('#settings-button').addEventListener('click',()=>openDrawer(document.body.classList.contains('show-settings')?null:'settings'));
$('#panel-backdrop').addEventListener('click',()=>openDrawer(null));
all('[data-close-drawer]').forEach(button=>button.addEventListener('click',()=>openDrawer(null)));

function showInspector(part){
  selected=part;
  $('#inspector').classList.toggle('empty',!part);
  if(part){
    const info=parts[part];
    $('#inspector').style.setProperty('--component-color',info.color);
    $('#inspector').innerHTML='<h3>'+info.name+'</h3><p>'+info.description+'</p><dl class="inspector-facts">'+info.facts.map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+value+'</dd></div>').join('')+'</dl><button class="focus-part" id="focus-part"><svg><use href="#i-focus"/></svg>定位这个部件</button>';
    $('#focus-part').addEventListener('click',()=>{
      if(!visibility[part])setVisibility(part,true);
      if(['horizontal','sensors','suspension'].includes(part)&&viewer.state.mode==='assembly')mode('cutaway');
      viewer.focus(part);openDrawer(null);
    });
  }else{
    $('#inspector').innerHTML='<p class="selection-hint">选择部件，查看结构与作用。</p>';
  }
  all('.part-row').forEach(row=>row.classList.toggle('selected',row.dataset.part===part));
  all('.part-select').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.part===part)));
  viewer?.select(part);
  if(part&&window.matchMedia('(max-width:1050px)').matches)openDrawer('settings');
}
function setVisibility(part,value){
  visibility[part]=value;viewer.setVisible(part,value);
  const button=$('.visibility-button[data-part="'+part+'"]');
  button.setAttribute('aria-pressed',String(value));
  button.setAttribute('aria-label',(value?'隐藏':'显示')+parts[part].name);
  if(!value&&selected===part)showInspector(null);
}
function updateRotationButton(){$('#rotate-button').setAttribute('aria-pressed',String(viewer.controls.autoRotate));}
function view(name){
  viewer.setView(name);
  all('[data-view]').forEach(button=>{button.classList.toggle('active',button.dataset.view===name);button.setAttribute('aria-pressed',String(button.dataset.view===name));});
  updateRotationButton();openDrawer(null);
}
function mode(name,amount){
  viewer.setMode(name);
  const value=amount??(name==='exploded'?1:0);
  viewer.setExplode(value);
  $('#explode').value=String(Math.round(value*100));
  $('#explode-value').textContent=Math.round(value*100)+'%';
  all('[data-mode]').forEach(button=>{button.classList.toggle('active',button.dataset.mode===name);button.setAttribute('aria-pressed',String(button.dataset.mode===name));});
}
function syncMotion(){
  if(!viewer)return;
  const {playing,dof,phase,amplitude}=viewer.state;
  $('#play-button').setAttribute('aria-pressed',String(playing));
  $('#play-button').setAttribute('aria-label',playing?'暂停运动演示':'播放运动演示');
  $('#play-button use').setAttribute('href',playing?'#i-pause':'#i-play');
  $('#play-label').textContent=playing?'暂停':'播放';
  const normalized=Math.sin(phase)*amplitude;
  const rawValue=dof.startsWith('r')?normalized*8:normalized*100;
  const value=Math.abs(rawValue)<.00005?0:rawValue;
  $('#motion-readout').textContent=dof.toUpperCase()+'  '+(value>0?'+':'')+value.toFixed(dof.startsWith('r')?1:0)+(dof.startsWith('r')?'°':'%');
  const degrees=playing?((phase*180/Math.PI)%360+360)%360:Math.max(0,Math.min(360,phase*180/Math.PI));
  $('#phase').value=String(degrees);
  $('#phase-value').textContent=Math.round(degrees)+'°';
  const position=degrees/360;
  $('#wave-dot').setAttribute('cx',String(2+position*120));
  $('#wave-dot').setAttribute('cy',String(16-12*Math.sin(phase)));
  $('.motion-panel').classList.toggle('playing',playing);
}
function setDOF(dof){
  viewer.setDof(dof);$('#motion-caption').textContent=dofs[dof];
  all('[data-dof]').forEach(button=>{button.classList.toggle('active',button.dataset.dof===dof);button.setAttribute('aria-pressed',String(button.dataset.dof===dof));});
  syncMotion();
}
function reset(){
  viewer.resetMotion();setDOF('z');viewer.setAmplitude(.5);viewer.setSpeed(1);
  $('#amplitude').value='50';$('#amplitude-value').textContent='50%';
  all('[data-speed]').forEach(b=>{b.classList.toggle('active',b.dataset.speed==='1');b.setAttribute('aria-pressed',String(b.dataset.speed==='1'));});
  Object.keys(parts).forEach(part=>setVisibility(part,true));
  mode('internal');viewer.setLabels(true);viewer.setAxes(false);viewer.setGrid(false);
  $('#labels-toggle').checked=true;$('#axes-toggle').checked=false;$('#grid-toggle').checked=false;$('#axes-key').hidden=true;
  showInspector(null);view('iso');syncMotion();toast('场景已复位');
}
const codes={base:'固定结构',platform:'运动结构',suspension:'B1 · B2 · B3',horizontal:'H1 · H2 · H3',vertical:'V1 · V2 · V3',sensors:'S1 · S2 · S3'};
$('#parts-tree').innerHTML=Object.entries(parts).map(([id,part])=>'<div class="part-row" data-part="'+id+'"><button class="part-select" data-part="'+id+'" aria-pressed="false" aria-label="选择'+part.name+'"><i class="part-dot" style="--part-color:'+part.color+'"></i><span class="part-copy">'+part.name+'<small>'+codes[id]+'</small></span></button><button class="visibility-button" data-part="'+id+'" aria-label="隐藏'+part.name+'" aria-pressed="true"><svg><use href="#i-eye"/></svg></button></div>').join('');
showInspector(null);
$('.motion-wave path').setAttribute('d',Array.from({length:65},(_,i)=>(i?'L':'M')+(2+i*120/64)+','+(16-12*Math.sin(i*Math.PI*2/64))).join(' '));
try{
  viewer=new PlatformViewer($('#scene'),$('#scene-labels'),part=>showInspector(selected===part?null:part),()=>{
    all('[data-view]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
  });
  viewer.onMotion=syncMotion;
  all('.part-select').forEach(button=>button.addEventListener('click',()=>showInspector(selected===button.dataset.part?null:button.dataset.part)));
  all('.visibility-button').forEach(button=>button.addEventListener('click',()=>setVisibility(button.dataset.part,!visibility[button.dataset.part])));
  all('[data-view]').forEach(button=>button.addEventListener('click',()=>view(button.dataset.view)));
  all('[data-mode]').forEach(button=>button.addEventListener('click',()=>{mode(button.dataset.mode);updateRotationButton();}));
  all('[data-dof]').forEach(button=>button.addEventListener('click',()=>setDOF(button.dataset.dof)));
  all('[data-speed]').forEach(button=>button.addEventListener('click',()=>{
    viewer.setSpeed(Number(button.dataset.speed));
    all('[data-speed]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
  }));
  $('#labels-toggle').addEventListener('change',e=>viewer.setLabels(e.target.checked));
  $('#axes-toggle').addEventListener('change',e=>{viewer.setAxes(e.target.checked);$('#axes-key').hidden=!e.target.checked;});
  $('#grid-toggle').addEventListener('change',e=>viewer.setGrid(e.target.checked));
  $('#explode').addEventListener('input',e=>{const amount=Number(e.target.value)/100;mode(amount?'exploded':'internal',amount);});
  $('#amplitude').addEventListener('input',e=>{viewer.setAmplitude(Number(e.target.value)/100);$('#amplitude-value').textContent=e.target.value+'%';syncMotion();});
  $('#phase').addEventListener('input',e=>{viewer.setPhase(Number(e.target.value)*Math.PI/180);syncMotion();});
  $('#play-button').addEventListener('click',()=>{viewer.play(!viewer.state.playing);syncMotion();});
  $('#motion-reset').addEventListener('click',()=>{viewer.resetMotion();syncMotion();});
  $('#rotate-button').addEventListener('click',()=>{viewer.controls.autoRotate=!viewer.controls.autoRotate;viewer.needsRender=true;updateRotationButton();});
  $('#fit-button').addEventListener('click',()=>viewer.fit());
  $('#zoom-in').addEventListener('click',()=>viewer.zoom(.82));
  $('#zoom-out').addEventListener('click',()=>viewer.zoom(1.22));
  $('#reset-button').addEventListener('click',reset);
  $('#export-button').addEventListener('click',async()=>{
    try{await viewer.exportPNG();toast('当前视图已导出');}catch(error){toast('导出失败，请重试');console.error(error);}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){viewer.play(false);viewer.controls.autoRotate=false;syncMotion();updateRotationButton();}});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){showInspector(null);openDrawer(null);return;}
    if(['INPUT','SELECT','TEXTAREA','BUTTON','A'].includes(document.activeElement?.tagName))return;
    if(event.code==='Space'){event.preventDefault();viewer.play(!viewer.state.playing);syncMotion();}
    if(event.key==='+'||event.key==='='){event.preventDefault();viewer.zoom(.82);}
    if(event.key==='-'){event.preventDefault();viewer.zoom(1.22);}
  });
  syncMotion();
  requestAnimationFrame(()=>{$('#loading').classList.add('hidden');$('#render-status').textContent='三维模型已就绪';});
}catch(error){
  console.error(error);$('#loading').classList.add('error');
  $('#loading strong').textContent='三维场景暂时无法启动';
  $('#loading span').textContent='请刷新页面，或使用支持 WebGL 2 并启用图形加速的浏览器。';
  $('#render-status').textContent='WebGL 不可用';
  all('button').forEach(button=>button.disabled=true);
}
