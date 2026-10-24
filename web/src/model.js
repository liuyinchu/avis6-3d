import * as THREE from 'three';
import {layout,parts,TAU,RADIUS,HEX_ROTATION,REST_Z,BODY_HEIGHT,LEAF_Z,H_CENTER_Z} from './config.js';
import {V,createFabricator,hexShape,circleHole,rectangleHole,withinHex,roundedPolygon} from './geometry.js';
export {REST_Z} from './config.js';

export function buildPlatform(){
  const f=createFabricator();
  const root=new THREE.Group();root.name='AVIS6-Refined';
  const rigid=new THREE.Group();rigid.name='L2-Rigid';rigid.position.z=REST_Z;root.add(rigid);
  const groups={},labels=[],arrows=[],directionLabels=[],directionAssets=new Set(),leaves=[],rods=[],sidePanels=[];
  const group=(part,parent=root)=>{const g=new THREE.Group();g.userData.part=part;parent.add(g);(groups[part]??=[]).push(g);return g;};
  const tag=(text,parent,p,part)=>labels.push({text,parent,position:V(...p),part});
  const arrow=(parent,p,dir,color,length,metadata)=>{
    const a=new THREE.Group();a.position.copy(V(...p));
    a.quaternion.setFromUnitVectors(V(0,1,0),V(...dir).normalize());
    const head=.20,shaft=new THREE.CylinderGeometry(.04,.04,length-head,12),cone=new THREE.ConeGeometry(.115,head,18);
    const material=new THREE.MeshBasicMaterial({color,depthTest:false,depthWrite:false,transparent:true,opacity:.96,toneMapped:false});
    const stem=new THREE.Mesh(shaft,material),tip=new THREE.Mesh(cone,material);
    stem.position.y=(length-head)/2;tip.position.y=length-head/2;
    [stem,tip].forEach(m=>{m.renderOrder=500;m.userData.direction=true;a.add(m);});
    [shaft,cone,material].forEach(asset=>directionAssets.add(asset));
    a.visible=false;parent.add(a);arrows.push({object:a,...metadata});
    directionLabels.push({parent:a,position:V(0,length+.10,0),text:metadata.text,part:metadata.part,color:'#'+color.toString(16).padStart(6,'0')});
  };
  const plate=(parent,part,r,z,h,key='aluminum',holes=[],bevel=.012)=>f.extrude(hexShape(r,holes),h,key,parent,part,V(0,0,z),bevel);
  const boltCircle=(parent,part,x,y,z,r,n,size=.025)=>{for(let i=0;i<n;i++){const a=i*TAU/n;f.bolt(parent,part,x+r*Math.cos(a),y+r*Math.sin(a),z,size);}};
  const surfacePattern=(radius,step,exclusions=[])=>{
    const holes=[];for(let x=-radius;x<=radius;x+=step)for(let y=-radius;y<=radius;y+=step){
      if(withinHex(x,y,radius)&&exclusions.every(p=>Math.hypot(x-p[0],y-p[1])>.6))holes.push(circleHole(x,y,.021));
    }return holes;
  };

  // Fixed L1 base. Separate machined flanges and pedestal remain below the moving body.
  const base=group('base');base.name='L1-Fixed';
  const baseHoles=surfacePattern(3.55,.36);
  plate(base,'base',3.85,-.10,.31,'aluminum',baseHoles,.018);
  plate(base,'base',3.82,-.14,.035,'dark');
  f.cylinder(base,'base',0,0,-.46,.57,.58,'steel',64);
  f.cylinder(base,'base',0,0,-.15,.91,.12,'aluminum',64);
  f.cylinder(base,'base',0,0,-.79,.84,.10,'aluminum',64);
  f.torus(base,'base',0,0,-.73,.57,.018,'dark');
  for(const z of [-.18,-.69])f.torus(base,'base',0,0,z,.575,.012,'silver');
  boltCircle(base,'base',0,0,-.73,.70,12,.038);
  for(let i=0;i<6;i++){
    const a=HEX_ROTATION+i*TAU/6;
    f.bolt(base,'base',3.63*Math.cos(a),3.63*Math.sin(a),.225,.042);
    const bracket=f.box(base,'base',3.30*Math.cos(a),3.30*Math.sin(a),-.055,.35,.18,.26,'steel',.025);bracket.rotation.z=a;
  }
  const idPlate=f.nameplate(base,'base','AVIS Six  -  L1',1.15,.21,V(.4,-3.34,.06));
  idPlate.rotation.x=Math.PI/2;
  tag('L1',base,[0,-3.3,.31],'base');

  // L2 shell, bored bottom plate, perimeter skin and perforated internal partition network.
  const floor=group('platform',rigid),frame=group('platform',rigid),panels=group('platform',rigid),lid=group('platform',rigid);
  const inner=group('platform',rigid);
  const clearanceHoles=layout.suspension.map(({root:[x,y]})=>rectangleHole(x,y,.68,.68,.08));
  const floorHoles=surfacePattern(3.18,.43,layout.suspension.map(p=>p.root));
  plate(floor,'platform',RADIUS,0,.115,'light',[...clearanceHoles,...floorHoles],.009);
  // Machined rim around each tower clearance is attached only to L2.
  layout.suspension.forEach(({root:[x,y]})=>{
    const s=roundedPolygon([[-.39,-.39],[.39,-.39],[.39,.39],[-.39,.39]],.08);
    s.holes.push(rectangleHole(0,0,.68,.68,.08));
    f.extrude(s,.022,'steel',floor,'platform',V(x,y,.12),.003);
    for(const dx of [-.35,.35])for(const dy of [-.35,.35])f.bolt(floor,'platform',x+dx,y+dy,.15,.018);
  });
  for(let i=0;i<6;i++){
    const a=HEX_ROTATION+i*TAU/6,b=a+TAU/6;
    const p=[RADIUS*Math.cos(a),RADIUS*Math.sin(a)],q=[RADIUS*Math.cos(b),RADIUS*Math.sin(b)];
    const panel=f.platePanel(panels,'platform',p,q,1.57,'aluminum',.14,.065,true);
    sidePanels.push(panel);
    const post=f.box(frame,'platform',(RADIUS-.08)*Math.cos(a),(RADIUS-.08)*Math.sin(a),.94,.11,.11,1.65,'steel',.012);post.rotation.z=a;
    const center=V((p[0]+q[0])/2,(p[1]+q[1])/2,1.75);
    const rail=f.box(frame,'platform',...center.toArray(),RADIUS+.025,.15,.09,'aluminum',.012);
    rail.rotation.z=Math.atan2(q[1]-p[1],q[0]-p[0]);
    for(let j=0;j<11;j++){
      const t=(j+.5)/11;
      f.bolt(frame,'platform',p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,1.806,.024);
    }
  }
  const topHoles=surfacePattern(3.27,.28);
  plate(lid,'platform',RADIUS,1.82,.10,'light',topHoles,.008);
  for(let i=0;i<6;i++){
    const a=HEX_ROTATION+i*TAU/6;boltCircle(lid,'platform',(RADIUS-.18)*Math.cos(a),(RADIUS-.18)*Math.sin(a),1.936,.07,3,.02);
  }
  const boundaryRadius=angle=>{
    let max=0;for(let i=0;i<6;i++)max=Math.max(max,Math.cos(angle-(HEX_ROTATION+(i+.5)*TAU/6)));
    return RADIUS*Math.cos(Math.PI/6)/max-.055;
  };
  const divisionAngles=[15,70,135,190,255,315].map(d=>d*Math.PI/180);
  divisionAngles.forEach((angle,i)=>{
    const r=boundaryRadius(angle),a=[.92*Math.cos(angle),.92*Math.sin(angle)],b=[r*Math.cos(angle),r*Math.sin(angle)];
    f.platePanel(inner,'platform',a,b,1.27,'aluminum',.14,.045,true);
  });
  const anchorTriangle=layout.suspension.map(({tip})=>tip.map(v=>v*.78));
  for(let i=0;i<3;i++)f.platePanel(inner,'platform',anchorTriangle[i],anchorTriangle[(i+1)%3],.86,'light',.14,.055,true);
  // Lower diagonals are structural ribs; their fasteners are clearly separate from the suspension.
  layout.suspension.forEach(({tip},i)=>{
    const next=layout.suspension[(i+1)%3].root;
    const start=[tip[0]*1.2,tip[1]*1.2],end=[next[0]*.80,next[1]*.80];
    if(Math.hypot(start[0]-end[0],start[1]-end[1])>.6)f.platePanel(inner,'platform',start,end,.36,'steel',.14,.045,false);
  });
  tag('L2',floor,[2.1,-1.4,.23],'platform');

  // Fixed columns, root clamps and flexible blue leaves, matching the actual platform photo.
  const columns=group('suspension'),leafGroup=group('suspension'),rodGroup=group('suspension'),anchors=group('suspension',rigid);
  const segments=24;
  layout.suspension.forEach(({root:[x,y],tip:[tx,ty]},i)=>{
    const angle=Math.atan2(ty-y,tx-x);
    const foot=f.box(columns,'suspension',x,y,.32,.70,.64,.19,'aluminum',.025);
    f.box(columns,'suspension',x,y,1.61,.40,.40,2.42,'aluminum',.022);
    for(const sign of [-1,1]){
      f.box(columns,'suspension',x+sign*.19,y,1.60,.045,.41,2.26,'steel',.004);
      for(let j=0;j<5;j++)f.bolt(columns,'suspension',x+sign*.218,y,1.4+j*.28,.025,V(sign,0,0));
    }
    for(const dx of [-.25,.25])for(const dy of [-.22,.22])f.bolt(columns,'suspension',x+dx,y+dy,.43,.04);
    const cap=new THREE.Group();cap.position.set(x,y,LEAF_Z-.065);cap.rotation.z=angle;columns.add(cap);
    f.box(cap,'suspension',0,0,0,.48,.79,.13,'steel',.02);
    f.box(cap,'suspension',-.01,0,.105,.42,.74,.05,'light',.012);
    for(const dx of [-.13,.13])for(const dy of [-.27,-.09,.09,.27])f.bolt(cap,'suspension',dx,dy,.143,.031);
    const geometry=new THREE.BufferGeometry(),positions=new Float32Array((segments+1)*4*3),indices=[];
    for(let j=0;j<segments;j++){const a=j*4,b=(j+1)*4;indices.push(a,a+1,b,a+1,b+1,b,a+2,b+2,a+3,a+3,b+2,b+3,a,b,a+2,a+2,b,b+2,a+1,a+3,b+1,a+3,b+3,b+1);}
    indices.push(0,2,1,1,2,3);const end=segments*4;indices.push(end,end+1,end+2,end+1,end+3,end+2);
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);
    const leaf=f.mesh(geometry,'spring',leafGroup,'suspension');leaf.material.side=THREE.DoubleSide;
    const tipJoint=new THREE.Group();tipJoint.position.set(tx,ty,LEAF_Z-.085);leafGroup.add(tipJoint);
    f.ring(tipJoint,'suspension',0,0,0,.092,.037,.035,'steel');
    f.sphere(tipJoint,'suspension',0,0,-.017,.052,'silver');
    const rod=f.cylinder(rodGroup,'suspension',tx,ty,2.1,.018,1,'silver',16);
    const anchor=new THREE.Group();anchor.position.set(tx,ty,.155);anchors.add(anchor);
    f.box(anchor,'suspension',0,0,0,.27,.23,.06,'steel',.015);
    f.sphere(anchor,'suspension',0,0,.045,.052,'silver');
    for(const dx of [-.095,.095])f.bolt(anchor,'suspension',dx,0,.036,.023);
    const collar=f.cylinder(anchors,'suspension',tx,ty,.29,.035,.12,'dark',6);
    leaves.push({root:V(x,y,LEAF_Z),tip:V(tx,ty,LEAF_Z-.085),geometry,tipJoint});
    rods.push({mesh:rod,anchor:V(tx,ty,.2),index:i});
    tag('B'+(i+1),leafGroup,[(x+tx)/2,(y+ty)/2,LEAF_Z+.12],'suspension');
  });

  // Horizontal motors: in L2, adjacent to the suspension roots. No H stator or
  // support is placed in the L1/L2 gap. The fixed attachment is via the L1 pillar.
  const hFixed=group('horizontal'),hMoving=group('horizontal',rigid);
  const hBodies=[];
  layout.horizontal.forEach(({xy:[x,y],angle,pillar},i)=>{
    const stator=new THREE.Group();stator.name='H'+(i+1)+'-Fixed';stator.position.set(x,y,H_CENTER_Z);stator.rotation.z=angle;hFixed.add(stator);
    f.box(stator,'horizontal',-.36,0,-.18,.75,.30,.085,'steel',.012);
    f.box(stator,'horizontal',-.60,0,-.04,.10,.36,.39,'aluminum',.015);
    f.box(stator,'horizontal',0,0,-.205,.82,.44,.075,'dark',.018);
    for(const side of [-1,1]){
      f.box(stator,'horizontal',0,side*.175,.005,.76,.10,.34,'aluminum',.018);
      f.box(stator,'horizontal',0,side*.135,.005,.61,.035,.24,'black',.005);
      for(const u of [-.27,.27])f.bolt(stator,'horizontal',u,side*.177,.184,.026);
    }
    f.box(stator,'horizontal',0,0,.204,.79,.43,.05,'steel',.012);
    f.nameplate(stator,'horizontal','H'+(i+1)+'  /  VCM',.53,.15,V(0,0,.232));
    // Two guide bushings leave a visible copper winding and air gap.
    for(const u of [-.30,.30]){
      const bearing=f.ring(stator,'horizontal',u,0,0,.115,.051,.055,'dark');bearing.rotation.y=Math.PI/2;
    }
    const mover=new THREE.Group();mover.name='H'+(i+1)+'-Moving';mover.position.set(x,y,H_CENTER_Z-REST_Z);mover.rotation.z=angle;hMoving.add(mover);
    const core=f.cylinder(mover,'horizontal',0,0,0,.082,.30,'black',32);core.quaternion.setFromUnitVectors(V(0,1,0),V(1,0,0));
    for(let j=0;j<15;j++){const turn=f.torus(mover,'horizontal',-.13+j*.018,0,0,.091,.006,'copper');turn.rotation.y=Math.PI/2;}
    const shaft=f.cylinder(mover,'horizontal',.30,0,0,.038,.60,'silver',24);shaft.quaternion.setFromUnitVectors(V(0,1,0),V(1,0,0));
    const h=H_CENTER_Z-REST_Z-.16;
    f.box(mover,'horizontal',.60,0,-h/2,.12,.28,h,'aluminum',.018);
    f.box(mover,'horizontal',.60,0,-h,.40,.43,.07,'steel',.015);
    for(const u of [-.11,.11])for(const v of [-.14,.14])f.bolt(mover,'horizontal',.6+u,v,-h+.05,.026);
    f.bolt(mover,'horizontal',.68,0,0,.033,V(1,0,0));
    tag('H'+(i+1),mover,[0,0,.34],'horizontal');
    arrow(mover,[0,0,.36],[1,0,0],0x326f9e,.95,{kind:'force',part:'horizontal',text:'H'+(i+1)+' +'});
    hBodies.push({stator,mover,pillar});
  });

  const vFixed=group('vertical'),vMoving=group('vertical',rigid);
  layout.vertical.forEach(([x,y],i)=>{
    f.box(vFixed,'vertical',x,y,.30,.60,.59,.16,'aluminum',.025);
    for(const dx of [-.22,.22])for(const dy of [-.21,.21])f.bolt(vFixed,'vertical',x+dx,y+dy,.4,.029);
    f.cylinder(vFixed,'vertical',x,y,.56,.23,.31,'dark',48);
    f.ring(vFixed,'vertical',x,y,.39,.265,.13,.06,'steel');
    f.ring(vFixed,'vertical',x,y,.73,.263,.115,.07,'light');
    boltCircle(vFixed,'vertical',x,y,.81,.205,6,.022);
    for(let j=0;j<9;j++)f.torus(vFixed,'vertical',x,y,.42+j*.035,.232,.008,'copper');
    f.cylinder(vMoving,'vertical',x,y,-.67,.105,.30,'copper',32);
    f.cylinder(vMoving,'vertical',x,y,-.32,.043,.64,'silver',24);
    f.cylinder(vMoving,'vertical',x,y,-.08,.063,.095,'steel',6);
    f.box(vMoving,'vertical',x,y,-.009,.30,.29,.06,'light',.015);
    for(const dx of [-.10,.10])for(const dy of [-.10,.10])f.bolt(vMoving,'vertical',x+dx,y+dy,.025,.022);
    tag('V'+(i+1),vFixed,[x,y,.91],'vertical');
    arrow(vMoving,[x+.32,y,-.65],[0,0,1],0xba723c,.95,{kind:'force',part:'vertical',text:'V'+(i+1)+' +'});
  });

  const sensorGroup=group('sensors',rigid);
  layout.sensors.forEach(({xy:[x,y],angle},i)=>{
    const sensor=new THREE.Group();sensor.position.set(x,y,.16);sensor.rotation.z=angle;sensorGroup.add(sensor);
    f.cylinder(sensor,'sensors',0,0,.04,.405,.075,'steel',64);
    f.ring(sensor,'sensors',0,0,.08,.382,.33,.035,'black');
    f.cylinder(sensor,'sensors',0,0,.15,.35,.14,'light',64);
    const profile=[[0,.52],[.10,.515],[.22,.48],[.30,.41],[.342,.30],[.35,.21]].reverse().map(([r,z])=>new THREE.Vector2(r,z));
    const dome=f.mesh(new THREE.LatheGeometry(profile,64),'green',sensor,'sensors');dome.rotation.x=Math.PI/2;
    f.torus(sensor,'sensors',0,0,.215,.351,.009,'dark');
    boltCircle(sensor,'sensors',0,0,.092,.377,12,.018);
    for(let j=0;j<3;j++){
      const a=j*TAU/3,cx=.31*Math.cos(a),cy=.31*Math.sin(a);
      f.cylinder(sensor,'sensors',cx,cy,-.035,.034,.15,'steel',16);
      f.cylinder(sensor,'sensors',cx,cy,-.096,.06,.025,'dark',24);
      for(let k=0;k<5;k++)f.torus(sensor,'sensors',cx,cy,-.055+k*.018,.035,.004,'silver');
    }
    const connector=f.cylinder(sensor,'sensors',.35,0,.16,.052,.11,'steel',16);connector.quaternion.setFromUnitVectors(V(0,1,0),V(1,0,0));
    const port=f.cylinder(sensor,'sensors',.411,0,.16,.038,.018,'black',12);port.quaternion.copy(connector.quaternion);
    f.nameplate(sensor,'sensors','S'+(i+1)+' / 3-AXIS',.30,.075,V(-.02,-.31,.17),new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,0)));
    tag('S'+(i+1),sensor,[0,0,.65],'sensors');
    arrow(sensor,[0,0,.35],[1,0,0],0xca5b52,.72,{kind:'sensor',part:'sensors',text:'S'+(i+1)+'·X'});
    arrow(sensor,[0,0,.35],[0,1,0],0x2b946e,.72,{kind:'sensor',part:'sensors',text:'S'+(i+1)+'·Y'});
    arrow(sensor,[0,0,.35],[0,0,1],0x377fcc,.72,{kind:'sensor',part:'sensors',text:'S'+(i+1)+'·Z'});
  });
  const coordinate=new THREE.Group();coordinate.position.set(0,0,.19);rigid.add(coordinate);
  arrow(coordinate,[0,0,0],[1,0,0],0xca5b52,1.45,{kind:'global',part:null,text:'X'});
  arrow(coordinate,[0,0,0],[0,1,0],0x2b946e,1.45,{kind:'global',part:null,text:'Y'});
  arrow(coordinate,[0,0,0],[0,0,1],0x377fcc,1.45,{kind:'global',part:null,text:'Z'});
  f.flushBolts();
  // Check the actual assembled stator meshes, not only their nominal centers.
  // This catches regressions that place H hardware in the L1/L2 gap.
  root.updateMatrixWorld(true);
  const horizontalClearance = hBodies.map(({stator},index)=>{
    const bounds=new THREE.Box3().setFromObject(stator);
    if(bounds.min.z<REST_Z+.115 || bounds.max.z>REST_Z+BODY_HEIGHT) throw new Error('H'+(index+1)+' is outside the L2 installation envelope');
    return {part:'H'+(index+1),minZ:Number(bounds.min.z.toFixed(3)),maxZ:Number(bounds.max.z.toFixed(3))};
  });
  console.info('AVIS-6 assembly envelope verified',JSON.stringify({L2:[REST_Z+.115,REST_Z+BODY_HEIGHT],H:horizontalClearance}));

  let selection=null,lastKey='',mode='internal',explode=0,axesEnabled=false;
  const visible=Object.fromEntries(Object.keys(parts).map(k=>[k,true]));
  function updateLeaf(leaf,tip){
    const delta=tip.clone().sub(leaf.root),across=V(-delta.y,delta.x,0).normalize(),positions=leaf.geometry.attributes.position;
    for(let i=0;i<=segments;i++){
      const t=i/segments,center=leaf.root.clone().lerp(tip,t),w=.74*Math.pow(1-t,.9)+.12*t;
      center.z=leaf.root.z+(tip.z-leaf.root.z)*t*t;
      for(let j=0;j<4;j++){const p=center.clone().addScaledVector(across,(j%2?-1:1)*w/2);p.z+=j<2?.018:-.018;positions.setXYZ(i*4+j,...p.toArray());}
    }
    positions.needsUpdate=true;leaf.geometry.computeVertexNormals();leaf.geometry.computeBoundingSphere();leaf.geometry.computeBoundingBox();
  }
  function update(pose,e=0){
    explode=e;
    rigid.position.set(pose.x,pose.y,REST_Z+pose.z+e*1.6);rigid.rotation.set(pose.rx,pose.ry,pose.rz,'XYZ');
    columns.position.z=leafGroup.position.z=hFixed.position.z=e*1.6;
    lid.position.z=e*2.4;panels.position.z=e*.4;
    sidePanels.forEach(p=>p.object.position.copy(p.rest).addScaledVector(p.outward,e*1.5));
    root.updateMatrixWorld(true);
    const key=JSON.stringify(pose)+':'+e;if(key===lastKey)return;lastKey=key;
    rods.forEach(({mesh,anchor,index})=>{
      const leaf=leaves[index],lower=rigid.localToWorld(anchor.clone());
      const atRest=anchor.clone().add(V(0,0,REST_Z+e*1.6)),delta=lower.clone().sub(atRest);
      const upperLocal=leaf.tip.clone().addScaledVector(delta,.55);updateLeaf(leaf,upperLocal);leaf.tipJoint.position.copy(upperLocal);
      const upper=leafGroup.localToWorld(upperLocal.clone()),vector=upper.clone().sub(lower);
      mesh.position.copy(lower.clone().add(upper).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(V(0,1,0),vector.clone().normalize());mesh.scale.y=vector.length();
    });
  }
  function applyVisibility(){
    Object.entries(groups).forEach(([part,items])=>items.forEach(g=>g.visible=visible[part]));
    lid.visible=visible.platform&&['assembly','exploded'].includes(mode);
    const fullyOpen=mode==='cutaway';
    panels.visible=frame.visible=inner.visible=visible.platform&&!fullyOpen;
    sidePanels.forEach(panel=>panel.object.visible=true);
    applyDirections();
  }
  function setMode(value){mode=value;applyVisibility();}
  function setVisible(part,value){visible[part]=value;applyVisibility();}
  function applyDirections(){
    arrows.forEach(a=>{
      const relevant=a.kind==='global'?selection!=='sensors':a.kind==='sensor'?selection==='sensors':(!selection||selection===a.part);
      a.object.visible=axesEnabled&&relevant;
    });
  }
  function setAxes(value){axesEnabled=Boolean(value);applyDirections();}
  function select(part){selection=part;f.highlight(part);applyDirections();}
  function getFitPoints(part){
    root.updateMatrixWorld(true);const points=[],seen=new Set();
    (part?groups[part]:[root]).forEach(group=>group.traverse(object=>{
      if(!object.isMesh||object.userData.direction||seen.has(object))return;
      seen.add(object);
      for(let parent=object;parent;parent=parent.parent)if(!parent.visible)return;
      let bounds;
      if(object.isInstancedMesh){if(!object.boundingBox)object.computeBoundingBox();bounds=object.boundingBox;}
      else{if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();bounds=object.geometry.boundingBox;}
      if(!bounds||bounds.isEmpty())return;
      for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])points.push(V(x,y,z).applyMatrix4(object.matrixWorld));
    }));
    return points;
  }
  function getBounds(part){return new THREE.Box3().setFromPoints(getFitPoints(part));}
  update({x:0,y:0,z:0,rx:0,ry:0,rz:0});applyVisibility();
  return {root,rigid,groups,labels,directionLabels,pickables:f.pickables,update,setMode,setVisible,setAxes,select,getBounds,getFitPoints,
    getState:()=>({mode,explode,visible:{...visible},selection}),dispose:()=>{f.dispose();directionAssets.forEach(a=>a.dispose());}};
}
