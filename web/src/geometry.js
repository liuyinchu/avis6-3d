import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {TAU,HEX_ROTATION} from './config.js';
export const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

export function roundedPolygon(vertices,round=.12,hole=false){
  const path=hole?new THREE.Path():new THREE.Shape();
  const items=vertices.map((p,i)=>{
    const previous=vertices[(i+vertices.length-1)%vertices.length],next=vertices[(i+1)%vertices.length];
    return {p,a:[p[0]+(previous[0]-p[0])*round,p[1]+(previous[1]-p[1])*round],b:[p[0]+(next[0]-p[0])*round,p[1]+(next[1]-p[1])*round]};
  });
  path.moveTo(...items[0].a);
  items.forEach(({p,a,b},i)=>{if(i)path.lineTo(...a);path.quadraticCurveTo(...p,...b);});
  path.closePath();return path;
}
export function rectangleHole(x,y,w,h,r=.08){
  return roundedPolygon([[x-w/2,y-h/2],[x-w/2,y+h/2],[x+w/2,y+h/2],[x+w/2,y-h/2]],r,true);
}
export function circleHole(x,y,r){const p=new THREE.Path();p.absarc(x,y,r,0,TAU,true);return p;}
export function hexShape(radius,holes=[]){
  const s=new THREE.Shape();
  for(let i=0;i<6;i++){const a=HEX_ROTATION+i*TAU/6;i?s.lineTo(radius*Math.cos(a),radius*Math.sin(a)):s.moveTo(radius*Math.cos(a),radius*Math.sin(a));}
  s.closePath();s.holes.push(...holes);return s;
}
export function withinHex(x,y,r){
  for(let i=0;i<6;i++){const a=HEX_ROTATION+(i+.5)*TAU/6;if(x*Math.cos(a)+y*Math.sin(a)>r*Math.cos(Math.PI/6))return false;}return true;
}

export function createFabricator(){
  const materialCache=new Map(),geometryCache=new Map(),geometries=new Set(),textures=new Set();
  const pickables=[],edges=[],boltBatches=new Map(),decorations=[];
  // Fine directional grain is synthesized in the browser; reference images are not used as textures.
  const grainData=new Uint8Array(256*128*4);let seed=17;
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<128;y++){const stripe=120+rand()*24;for(let x=0;x<256;x++){const value=stripe+(rand()-.5)*18;const at=(y*256+x)*4;grainData[at]=grainData[at+1]=grainData[at+2]=value;grainData[at+3]=255;}}
  const grain=new THREE.DataTexture(grainData,256,128);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.repeat.set(2,3);grain.needsUpdate=true;textures.add(grain);
  const specs={
    aluminum:{color:0x9eabb5,metalness:.9,roughness:.34,anisotropy:.32},
    light:{color:0xbac5cb,metalness:.9,roughness:.29,anisotropy:.25},
    steel:{color:0x8a9aa5,metalness:.96,roughness:.23},
    dark:{color:0x465360,metalness:.8,roughness:.3},
    blue:{color:0x296f95,metalness:.74,roughness:.3},
    spring:{color:0x167ca8,metalness:.7,roughness:.29,clearcoat:.25},
    copper:{color:0xb36c3b,metalness:.95,roughness:.27},
    green:{color:0x849c8b,metalness:.32,roughness:.3,clearcoat:.32},
    black:{color:0x202b31,metalness:.35,roughness:.45},
    rubber:{color:0x242c30,metalness:0,roughness:.85},
    silver:{color:0xe0e3e1,metalness:.95,roughness:.2}
  };
  function mat(part,key){
    const id=part+':'+key;if(!materialCache.has(id)){
      const m=new THREE.MeshPhysicalMaterial(specs[key]||specs.aluminum);
      m.envMapIntensity=.9;
      if(['aluminum','light','steel','spring'].includes(key)){m.bumpMap=grain;m.bumpScale=.0018;}
      materialCache.set(id,m);
    }return materialCache.get(id);
  }
  function cached(id,build){if(!geometryCache.has(id)){const g=build();geometryCache.set(id,g);geometries.add(g);}return geometryCache.get(id);}
  function mesh(geometry,key,parent,part,position=V(),outline=false){
    geometries.add(geometry);const object=new THREE.Mesh(geometry,mat(part,key));
    object.position.copy(position);object.castShadow=object.receiveShadow=true;object.userData.part=part;parent.add(object);pickables.push(object);
    if(outline){const e=new THREE.EdgesGeometry(geometry,35);geometries.add(e);const edge=new THREE.LineSegments(e,new THREE.LineBasicMaterial({color:0x596774,transparent:true,opacity:.15}));edge.userData.part=part;object.add(edge);edges.push(edge);}return object;
  }
  function box(parent,part,x,y,z,w,d,h,key='aluminum',radius=.015){
    radius=Math.min(radius,w/4,d/4,h/4);
    const g=cached(['box',w,d,h,radius].join(':'),()=>new RoundedBoxGeometry(w,d,h,2,radius));
    return mesh(g,key,parent,part,V(x,y,z));
  }
  function cylinder(parent,part,x,y,z,r,h,key='steel',segments=32){
    const g=cached(['cylinder',r,h,segments].join(':'),()=>new THREE.CylinderGeometry(r,r,h,segments));
    const object=mesh(g,key,parent,part,V(x,y,z));object.rotation.x=Math.PI/2;return object;
  }
  function sphere(parent,part,x,y,z,r,key='steel'){
    return mesh(cached('sphere'+r,()=>new THREE.SphereGeometry(r,24,16)),key,parent,part,V(x,y,z));
  }
  function extrude(shape,depth,key,parent,part,position=V(),bevel=.01){
    return mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelSegments:2,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:8}),key,parent,part,position);
  }
  function ring(parent,part,x,y,z,outer,inner,h,key='steel'){
    const id=['ring',outer,inner,h].join(':');
    const geometry=cached(id,()=>{const s=new THREE.Shape();s.absarc(0,0,outer,0,TAU,false);s.holes.push(circleHole(0,0,inner));return new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:false,curveSegments:18});});
    return mesh(geometry,key,parent,part,V(x,y,z));
  }
  function torus(parent,part,x,y,z,r,tube,key='steel'){
    return mesh(cached(['torus',r,tube].join(':'),()=>new THREE.TorusGeometry(r,tube,6,32)),key,parent,part,V(x,y,z));
  }
  // Repeated fasteners are instanced in their own attachment frame.
  function bolt(parent,part,x,y,z,r=.032,normal=V(0,0,1)){
    const id=parent.uuid+':'+part+':'+r;if(!boltBatches.has(id))boltBatches.set(id,{parent,part,r,items:[]});
    boltBatches.get(id).items.push({p:V(x,y,z),normal:normal.clone().normalize()});
  }
  function flushBolts(){
    const object=new THREE.Object3D();
    for(const {parent,part,r,items} of boltBatches.values()){
      const layers=[
        {radius:r*1.36,height:.009,z:0,key:'dark',segments:24},
        {radius:r,height:.025,z:.016,key:'silver',segments:16},
        {radius:r*.47,height:.001,z:.03,key:'black',segments:6}
      ];
      layers.forEach(layer=>{
        const geometry=cached(['fastener',r,layer.key].join(':'),()=>{const g=new THREE.CylinderGeometry(layer.radius,layer.radius,layer.height,layer.segments);g.rotateX(Math.PI/2);return g;});
        const batch=new THREE.InstancedMesh(geometry,mat(part,layer.key),items.length);batch.userData.part=part;batch.castShadow=batch.receiveShadow=true;
        items.forEach(({p,normal},i)=>{object.position.copy(p).addScaledVector(normal,layer.z);object.quaternion.setFromUnitVectors(V(0,0,1),normal);object.updateMatrix();batch.setMatrixAt(i,object.matrix);});
        batch.computeBoundingSphere();parent.add(batch);pickables.push(batch);
      });
    }boltBatches.clear();
  }
  function cable(parent,part,points,radius=.014,key='rubber'){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>Array.isArray(p)?V(...p):p));
    return mesh(new THREE.TubeGeometry(curve,32,radius,6,false),key,parent,part);
  }
  function nameplate(parent,part,text,w,h,position,rotation=null){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#d8dfe0';ctx.fillRect(0,0,512,128);ctx.strokeStyle='#80909a';ctx.lineWidth=5;ctx.strokeRect(8,8,496,112);
    ctx.font='bold 43px monospace';ctx.fillStyle='#394b58';ctx.textAlign='center';ctx.fillText(text,256,79);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.add(texture);
    const material=new THREE.MeshBasicMaterial({map:texture,polygonOffset:true,polygonOffsetFactor:-1});
    const geometry=new THREE.PlaneGeometry(w,h);geometries.add(geometry);
    const m=new THREE.Mesh(geometry,material);m.position.copy(position);if(rotation)m.quaternion.copy(rotation);m.userData.part=part;parent.add(m);decorations.push(m);return m;
  }
  function platePanel(parent,part,a,b,height,key='aluminum',floor=.14,thickness=.055,openings=true){
    const av=V(...a,0),bv=V(...b,0),dir=bv.clone().sub(av).normalize();
    const length=av.distanceTo(bv),outward=V(dir.y,-dir.x,0),middle=av.clone().add(bv).multiplyScalar(.5);
    const shape=roundedPolygon([[-length/2,0],[length/2,0],[length/2,height],[-length/2,height]],.015);
    if(openings&&length>.9){
      const l=-length/2+.16,r=length/2-.16,mid=height/2;
      if(length>1.35){
        [[[l,.14],[-.08,.14],[l,mid-.06]],[[l,mid+.06],[-.08,height-.14],[l,height-.14]],
         [[.08,.14],[r,.14],[r,mid-.06]],[[r,mid+.06],[r,height-.14],[.08,height-.14]]].forEach(v=>shape.holes.push(roundedPolygon(v,.2,true)));
      }else{shape.holes.push(rectangleHole(0,height/2,length-.3,height-.32,.3));}
    }
    const object=extrude(shape,thickness,key,parent,part,V(middle.x,middle.y,floor),.008);
    object.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(dir,V(0,0,1),outward));
    box(object,part,0,.025,-.025,length-.01,.05,.12,key,.008);
    box(object,part,0,height-.026,-.02,length-.01,.05,.10,key,.008);
    const n=Math.max(3,Math.floor(length/.24));
    for(let i=0;i<n;i++)for(const y of [.065,height-.065])bolt(object,part,-length/2+.09+i*(length-.18)/(n-1),y,thickness+.011,.021);
    for(const x of [-length/2+.065,length/2-.065])for(let j=1;j<4;j++)bolt(object,part,x,height*j/4,thickness+.012,.021);
    return {object,outward,middle,rest:object.position.clone()};
  }
  function highlight(part){
    materialCache.forEach((m,key)=>{m.emissive.setHex(part&&key.startsWith(part+':')?0x32678a:0);m.emissiveIntensity=part?.12:0;});
    edges.forEach(e=>e.material.opacity=e.userData.part===part?.38:.15);
  }
  return {mat,mesh,box,cylinder,sphere,extrude,ring,torus,bolt,flushBolts,cable,nameplate,platePanel,pickables,highlight,
    dispose(){geometries.forEach(g=>g.dispose());materialCache.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());edges.forEach(e=>e.material.dispose());decorations.forEach(m=>m.material.dispose());}
  };
}
