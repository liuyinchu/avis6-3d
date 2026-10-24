import * as THREE from 'three';
import {OrbitControls} from 'three/addons/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {buildPlatform} from './model.js';
import {parts} from './config.js';

const vec=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const zeroPose=()=>({x:0,y:0,z:0,rx:0,ry:0,rz:0});
const directions={iso:vec(.9,-1.32,1.5).normalize(),top:vec(0,-.001,1).normalize(),front:vec(0,-1,.025).normalize(),side:vec(1,0,.025).normalize()};
const shortNames={base:'固定基座',platform:'悬挂平台',suspension:'柔性悬挂',horizontal:'水平电机',vertical:'竖直电机',sensors:'惯性传感器'};
const SVG='http://www.w3.org/2000/svg';

export class PlatformViewer{
  constructor(container,labelContainer,onSelect,onOrbit){
    this.container=container;this.labelContainer=labelContainer;this.onSelect=onSelect;this.onOrbit=onOrbit;
    this.state={mode:'internal',dof:'z',playing:false,amplitude:.5,speed:1,labels:true,axes:false,explode:0,phase:0};
    this.pose=zeroPose();this.explodeCurrent=0;this.lastTime=0;this.disposed=false;this.needsRender=true;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0xdde2e1);this.scene.fog=new THREE.Fog(0xdde2e1,60,180);
    this.camera=new THREE.PerspectiveCamera(36,1,.05,300);this.camera.up.set(0,0,1);this.camera.position.set(8,-11,12);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.88;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute('aria-label','AVIS Six 三维装配模型');this.renderer.domElement.setAttribute('role','img');
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost',event=>{
      event.preventDefault();this.state.playing=false;
      document.querySelector('#render-status').textContent='图形上下文已丢失';
      document.querySelector('#loading').className='loading error';
      document.querySelector('#loading strong').textContent='请刷新页面恢复三维场景';
      document.querySelector('#loading span').textContent='浏览器暂时释放了图形资源。';
    });
    const pmrem=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment();
    this.environment=pmrem.fromScene(room,.025);this.scene.environment=this.environment.texture;room.dispose();pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x8295a8,.40));
    const key=new THREE.DirectionalLight(0xfff6e9,2.6);key.position.set(-5,-3,10);key.castShadow=true;
    key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-12;key.shadow.camera.right=12;key.shadow.camera.top=14;key.shadow.camera.bottom=-12;
    key.shadow.normalBias=.009;key.shadow.bias=-.0002;key.shadow.radius=4;this.scene.add(key);
    const fill=new THREE.DirectionalLight(0xdbe9ff,.85);fill.position.set(6,3,7);this.scene.add(fill);
    const pixels=new Uint8Array(128*128*4);let seed=89;
    for(let i=0;i<pixels.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const v=120+(seed%20);pixels[i]=pixels[i+1]=pixels[i+2]=v;pixels[i+3]=255;}
    this.floorGrain=new THREE.DataTexture(pixels,128,128);this.floorGrain.wrapS=this.floorGrain.wrapT=THREE.RepeatWrapping;
    this.floorGrain.repeat.set(90,90);this.floorGrain.needsUpdate=true;
    this.ground=new THREE.Mesh(new THREE.PlaneGeometry(260,260),new THREE.MeshStandardMaterial({color:0xcdd2cd,roughness:.97,metalness:.015,bumpMap:this.floorGrain,bumpScale:.007}));
    this.ground.position.z=-.86;this.ground.receiveShadow=true;this.scene.add(this.ground);
    this.grid=new THREE.GridHelper(100,100,0x7b9197,0x9dafb2);this.grid.rotation.x=Math.PI/2;this.grid.position.z=-.853;
    this.grid.material.transparent=true;this.grid.material.opacity=.24;this.grid.visible=false;this.scene.add(this.grid);
    this.model=buildPlatform();this.scene.add(this.model.root);
    this.composer=new EffectComposer(this.renderer);this.composer.renderTarget1.samples=4;this.composer.renderTarget2.samples=4;
    this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.aoPass=new SSAOPass(this.scene,this.camera,1,1,16);this.aoPass.kernelRadius=.38;this.aoPass.minDistance=.0005;this.aoPass.maxDistance=.035;
    this.composer.addPass(this.aoPass);this.composer.addPass(new OutputPass());
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true;this.controls.dampingFactor=.09;this.controls.zoomSpeed=.65;
    this.controls.minDistance=1.8;this.controls.maxDistance=110;this.controls.maxPolarAngle=Math.PI*.49;this.controls.minPolarAngle=.001;
    this.controls.screenSpacePanning=true;this.controls.autoRotateSpeed=.6;this.controls.target.set(0,0,1.6);
    // Wheel updates happen synchronously inside OrbitControls. Always invalidate
    // the next frame on change, including changes consumed before the RAF tick.
    this.controls.addEventListener('change',()=>{this.needsRender=true;});
    this.controls.addEventListener('start',()=>{this.cameraTransition=null;this.onOrbit();});
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();
    this.renderer.domElement.addEventListener('pointerdown',e=>{this.pointerStart={x:e.clientX,y:e.clientY,button:e.button};});
    this.renderer.domElement.addEventListener('pointerup',e=>{
      if(!this.pointerStart||this.pointerStart.button!==0||Math.hypot(e.clientX-this.pointerStart.x,e.clientY-this.pointerStart.y)>5)return;
      const hit=this.pick(e.clientX,e.clientY);this.onSelect(hit?.object.userData.part??null);this.pointerStart=null;
    });
    this.renderer.domElement.addEventListener('dblclick',e=>{const hit=this.pick(e.clientX,e.clientY);if(hit)this.focus(hit.object.userData.part);});
    // Callout buttons stay clickable without swallowing wheel / trackpad zoom.
    const forwardWheel=e=>{
      e.preventDefault();
      this.renderer.domElement.dispatchEvent(new WheelEvent('wheel',{deltaX:e.deltaX,deltaY:e.deltaY,deltaZ:e.deltaZ,deltaMode:e.deltaMode,clientX:e.clientX,clientY:e.clientY,ctrlKey:e.ctrlKey,shiftKey:e.shiftKey,bubbles:false,cancelable:true}));
    };
    labelContainer.addEventListener('wheel',forwardWheel,{passive:false});
    this.lineLayer=document.querySelector('#callout-lines');
    this.labelItems=this.model.labels.map(item=>{
      const el=document.createElement('button');el.className='scene-label';el.style.setProperty('--tag-color',parts[item.part].color);
      el.innerHTML='<span class="callout-id">'+item.text+'</span><span class="callout-name">'+shortNames[item.part]+'</span>';
      el.setAttribute('aria-label',item.text+' '+parts[item.part].name);
      el.addEventListener('click',()=>this.onSelect(item.part));labelContainer.appendChild(el);
      const line=document.createElementNS(SVG,'path'),dot=document.createElementNS(SVG,'circle');
      line.setAttribute('stroke',parts[item.part].color);line.setAttribute('fill','none');line.setAttribute('stroke-linejoin','round');
      dot.setAttribute('r','3.2');dot.setAttribute('fill','#f5fafb');dot.setAttribute('stroke',parts[item.part].color);
      this.lineLayer.append(line,dot);return {...item,el,line,dot};
    });
    this.directionItems=this.model.directionLabels.map(item=>{
      const el=document.createElement('span');el.className='direction-label';el.style.setProperty('--direction-color',item.color);
      el.textContent=item.text;document.querySelector('#direction-labels').appendChild(el);return {...item,el};
    });
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();
    this.setView('iso',true);this.frame=this.frame.bind(this);this.frameID=requestAnimationFrame(this.frame);
  }
  resize(){
    const previousAspect=this.camera.aspect;this.needsRender=true;
    this.width=this.container.clientWidth;this.height=this.container.clientHeight;if(!this.width||!this.height)return;
    this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width,this.height,false);this.composer.setSize(this.width,this.height);
    this.lineLayer?.setAttribute('viewBox','0 0 '+this.width+' '+this.height);
    if(this.homeDistance&&Math.abs(previousAspect-this.camera.aspect)>.2)this.fit();
  }
  objectVisible(object){for(let current=object;current;current=current.parent)if(!current.visible)return false;return true;}
  pick(x,y){
    const bounds=this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((x-bounds.left)/bounds.width*2-1,-(y-bounds.top)/bounds.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);
    return this.raycaster.intersectObjects(this.model.pickables,false).find(hit=>this.objectVisible(hit.object));
  }
  assemblyBounds(part){
    this.model.update(this.pose,this.state.explode);
    const points=this.model.getFitPoints(part);
    this.model.update(this.pose,this.explodeCurrent);
    const bounds=new THREE.Box3().setFromPoints(points);
    bounds.fitPoints=points;
    return bounds;
  }
  aim(bounds,direction,instant=false){
    if(bounds.isEmpty())return;
    const center=bounds.getCenter(vec()),right=vec(0,0,1).cross(direction).normalize();
    if(right.lengthSq()<.01)right.set(1,0,0);
    const up=direction.clone().cross(right).normalize();
    const tan=Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2);
    const heightFraction=this.width<550?.76:.86,widthFraction=this.width<550?.88:.90;
    let distance=3;
    const fitPoints=bounds.fitPoints??[bounds.min,bounds.max];
    for(const fitPoint of fitPoints){
      const point=fitPoint.clone().sub(center),depth=point.dot(direction);
      distance=Math.max(distance,depth+Math.abs(point.dot(up))/(tan*heightFraction),depth+Math.abs(point.dot(right))/(tan*this.camera.aspect*widthFraction));
    }
    distance=Math.min(distance*1.02,100);this.homeDistance=distance;
    center.addScaledVector(up,this.width<550?.18:.08);
    const position=center.clone().addScaledVector(direction,distance);
    this.needsRender=true;this.controls.autoRotate=false;
    if(instant){this.camera.position.copy(position);this.controls.target.copy(center);this.controls.update();}
    else this.cameraTransition={position,target:center};
  }
  setView(name,instant=false){this.aim(this.assemblyBounds(),(directions[name]??directions.iso).clone(),instant);}
  fit(){this.aim(this.assemblyBounds(),this.camera.position.clone().sub(this.controls.target).normalize());}
  focus(part){this.aim(this.assemblyBounds(part),this.camera.position.clone().sub(this.controls.target).normalize());}
  zoom(scale){
    this.cameraTransition=null;this.controls.autoRotate=false;
    const vector=this.camera.position.clone().sub(this.controls.target);
    vector.setLength(THREE.MathUtils.clamp(vector.length()*scale,this.controls.minDistance,this.controls.maxDistance));
    this.camera.position.copy(this.controls.target).add(vector);this.controls.update();this.needsRender=true;this.onOrbit();
  }
  setMode(mode){this.needsRender=true;this.state.mode=mode;this.model.setMode(mode);}
  setExplode(value){
    const changed=this.state.explode!==value;this.needsRender=true;this.state.explode=THREE.MathUtils.clamp(value,0,3);
    if(changed)this.fit();
  }
  setVisible(part,value){this.needsRender=true;this.model.setVisible(part,value);}
  select(part){this.needsRender=true;this.model.select(part);}
  setAxes(value){this.needsRender=true;this.state.axes=value;this.model.setAxes(value);}
  setLabels(value){this.needsRender=true;this.state.labels=value;}
  setGrid(value){this.needsRender=true;this.grid.visible=value;}
  recalculatePose(){
    this.pose=zeroPose();const amount=Math.sin(this.state.phase)*this.state.amplitude;
    this.pose[this.state.dof]=amount*(this.state.dof.startsWith('r')?THREE.MathUtils.degToRad(8):.32);this.needsRender=true;
  }
  setDof(dof){this.state.dof=dof;this.state.phase=0;this.recalculatePose();}
  setAmplitude(value){this.state.amplitude=THREE.MathUtils.clamp(value,0,1);this.recalculatePose();}
  setSpeed(value){this.state.speed=value;}
  setPhase(value){this.state.playing=false;this.state.phase=value;this.recalculatePose();}
  play(value){this.needsRender=true;this.state.playing=value;}
  resetMotion(){this.state.playing=false;this.state.phase=0;this.recalculatePose();}
  project(parent,anchor){
    const point=parent.localToWorld(anchor.clone());
    if(this.camera.position.clone().sub(point).dot(this.camera.getWorldDirection(vec()))>0)return null;
    point.project(this.camera);if(point.z< -1||point.z>1||Math.abs(point.x)>1.1||Math.abs(point.y)>1.1)return null;
    return {x:(point.x*.5+.5)*this.width,y:(-.5*point.y+.5)*this.height};
  }
  hideLabel(item){
    item.el.hidden=true;item.line.style.display=item.dot.style.display='none';item.displayed=false;
  }
  updateLabels(){
    const selected=this.model.getState().selection,candidates={left:[],right:[]},compact=this.width<550;
    const boxWidth=compact?48:135,boxHeight=compact?30:36;
    this.labelContainer.classList.toggle('compact',compact);
    this.labelItems.forEach(item=>{
      let visible=this.state.labels&&this.objectVisible(item.parent);
      if(this.state.mode==='assembly'&&['sensors','suspension','horizontal'].includes(item.part))visible=false;
      if(selected)visible=visible&&selected===item.part;
      else visible=visible&&(this.state.mode==='assembly'?['base','platform','vertical']:['horizontal','vertical','sensors']).includes(item.part);
      const anchor=item.position.clone();
      if(item.text==='L2'&&['assembly','exploded'].includes(this.state.mode))anchor.set(.7,-1.3,2.04+this.explodeCurrent*2.4);
      const point=visible?this.project(item.parent,anchor):null;
      if(!point){this.hideLabel(item);return;}
      const side=point.x<this.width/2?'left':'right';candidates[side].push({...item,item,point});
    });
    for(const [side,items] of Object.entries(candidates)){
      items.sort((a,b)=>a.point.y-b.point.y);
      const top=85,bottom=Math.max(top+boxHeight,this.height-112-boxHeight);
      const gap=Math.min(boxHeight+12,(bottom-top)/Math.max(1,items.length-1));
      let cursor=top-gap;
      items.forEach(entry=>{entry.y=Math.max(cursor+gap,Math.min(bottom,entry.point.y-boxHeight/2));cursor=entry.y;});
      const excess=items.length?Math.max(0,items[items.length-1].y-bottom):0;
      items.forEach((entry,index)=>{
        const {item,point}=entry,x=side==='left'?14:this.width-boxWidth-14;
        const y=Math.max(top,entry.y-excess),middle=y+boxHeight/2;
        const join=side==='left'?x+boxWidth:x,elbow=side==='left'?join+15:join-15;
        item.box={x,y,w:boxWidth,h:boxHeight};item.anchor=point;item.join=join;item.elbow=elbow;item.displayed=true;
        item.el.hidden=false;item.el.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px)';
        item.el.style.width=boxWidth+'px';item.el.style.height=boxHeight+'px';
        item.line.style.display=item.dot.style.display='';
        item.line.setAttribute('d','M'+point.x+','+point.y+' L'+elbow+','+middle+' L'+join+','+middle);
        item.line.setAttribute('stroke-width',selected?'1.8':'1.3');item.line.setAttribute('opacity',selected?'.9':'.6');
        item.dot.setAttribute('cx',String(point.x));item.dot.setAttribute('cy',String(point.y));item.dot.setAttribute('stroke-width','1.5');
      });
    }
    this.directionItems.forEach(item=>{
      const p=this.objectVisible(item.parent)?this.project(item.parent,item.position):null;
      item.displayed=Boolean(p);item.el.hidden=!p;
      if(p){item.point=p;item.el.style.transform='translate('+(p.x+6)+'px,'+(p.y-14)+'px)';}
    });
  }
  updateCompass(){
    const inverse=this.camera.quaternion.clone().invert();
    const axes=[{name:'X',v:vec(1,0,0),color:'#c65f57'},{name:'Y',v:vec(0,1,0),color:'#398d70'},{name:'Z',v:vec(0,0,1),color:'#3b7bb2'}];
    axes.forEach(a=>a.v.applyQuaternion(inverse));axes.sort((a,b)=>a.v.z-b.v.z);
    document.querySelector('#compass-svg').innerHTML='<circle cx="50" cy="50" r="27" fill="#f1f5f7" fill-opacity=".7" stroke="#c9d5dc" stroke-width=".8"/>'+axes.map(({name,v,color})=>{
      const x=50+v.x*30,y=50-v.y*30;
      return '<line x1="50" y1="50" x2="'+x+'" y2="'+y+'" stroke="'+color+'" stroke-width="2.1"/><circle cx="'+x+'" cy="'+y+'" r="9" fill="#eff5f8" stroke="'+color+'" stroke-width="1"/><text x="'+x+'" y="'+(y+3.5)+'" fill="'+color+'" stroke="none" text-anchor="middle" font-size="10" font-family="Arial" font-weight="600">'+name+'</text>';
    }).join('')+'<circle cx="50" cy="50" r="2.5" fill="#6f8798" stroke="none"/>';
    document.querySelector('#zoom-value').textContent=Math.round(100*this.homeDistance/this.controls.getDistance())+'%';
  }
  frame(time){
    if(this.disposed)return;
    const dt=Math.min(.05,(time-(this.lastTime||time))/1000);this.lastTime=time;
    if(this.cameraTransition){
      const {position,target}=this.cameraTransition,easing=1-Math.exp(-7*dt);
      this.camera.position.lerp(position,easing);this.controls.target.lerp(target,easing);
      if(this.camera.position.distanceTo(position)<.003&&this.controls.target.distanceTo(target)<.003){this.camera.position.copy(position);this.controls.target.copy(target);this.cameraTransition=null;}
    }
    const previous=this.explodeCurrent;
    this.explodeCurrent=THREE.MathUtils.lerp(this.explodeCurrent,this.state.explode,1-Math.exp(-7*dt));
    if(Math.abs(this.explodeCurrent-this.state.explode)<.0001)this.explodeCurrent=this.state.explode;
    if(this.state.playing){this.state.phase=(this.state.phase+dt*1.8*this.state.speed)%(Math.PI*2);this.recalculatePose();}
    const cameraChanged=this.controls.update();
    if(this.needsRender||cameraChanged||this.cameraTransition||this.state.playing||previous!==this.explodeCurrent){
      this.model.update(this.pose,this.explodeCurrent);this.scene.updateMatrixWorld(true);
      this.updateLabels();this.updateCompass();this.composer.render();this.onMotion?.();this.needsRender=false;
    }
    this.frameID=requestAnimationFrame(this.frame);
  }
  async exportPNG(){
    this.model.update(this.pose,this.explodeCurrent);this.scene.updateMatrixWorld(true);this.updateLabels();this.composer.render();
    const source=this.renderer.domElement,canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
    const context=canvas.getContext('2d');context.drawImage(source,0,0);
    const scale=canvas.width/this.width;context.scale(scale,scale);
    const wordmark=document.querySelector('.brand-wordmark');
    if(wordmark.complete)context.drawImage(wordmark,22,15,160,52);
    this.labelItems.filter(item=>item.displayed).forEach(item=>{
      const {x,y,w,h}=item.box,middle=y+h/2;
      context.strokeStyle=parts[item.part].color;context.lineWidth=1.4;context.beginPath();
      context.moveTo(item.anchor.x,item.anchor.y);context.lineTo(item.elbow,middle);context.lineTo(item.join,middle);context.stroke();
      context.fillStyle='#f4f8fa';context.fillRect(x,y,w,h);context.strokeRect(x,y,w,h);
      context.fillStyle=parts[item.part].color;context.font='600 12px sans-serif';context.fillText(item.text,x+8,y+h/2+4);
      if(w>70){context.fillStyle='#3e5566';context.font='11px sans-serif';context.fillText(shortNames[item.part],x+42,y+h/2+4);}
    });
    this.directionItems.filter(item=>item.displayed).forEach(item=>{
      context.font='bold 12px sans-serif';context.fillStyle=item.color;context.fillText(item.text,item.point.x+7,item.point.y-1);
    });
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('无法导出图像');
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='AVIS-Six-'+this.state.mode+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  dispose(){
    this.disposed=true;cancelAnimationFrame(this.frameID);this.resizeObserver.disconnect();this.controls.dispose();this.model.dispose();
    this.floorGrain.dispose();this.ground.geometry.dispose();this.ground.material.dispose();this.environment.dispose();this.aoPass.dispose();this.composer.dispose();this.renderer.dispose();
  }
}
