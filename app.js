const plane=document.querySelector('#image-plane'),canvas=document.querySelector('#canvas'),dialog=document.querySelector('#lightbox');
const intro=document.querySelector('.intro'),studio=document.querySelector('#about'),contact=document.querySelector('#team'),status=document.querySelector('#gallery-status');
studio.classList.add('canvas-panel');contact.classList.add('canvas-panel');
const panels=[intro,studio,contact];
const backdrop=document.createElement('div');backdrop.className='background-wordmark';backdrop.textContent='morethanviz';backdrop.setAttribute('aria-hidden','true');
const foregroundWordmark=backdrop.cloneNode(true);foregroundWordmark.classList.add('wordmark-front');
const canvasPaper=document.createElement('div');canvasPaper.className='canvas-paper';canvasPaper.setAttribute('aria-hidden','true');
const resetButton=document.querySelector('#reset'),zoomOutButton=document.querySelector('#zoom-out'),zoomInButton=document.querySelector('#zoom-in');
let paintedZoom=null,layoutFrame=0;
let wordmarkBox={width:1,height:1,top:0,viewportWidth:1,viewportHeight:1};
const typeMeasure=document.createElement('canvas').getContext('2d');
function measureWordmark(){
  const style=getComputedStyle(backdrop);
  typeMeasure.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const metrics=typeMeasure.measureText(backdrop.textContent);
  const baseline=document.createElement('span');
  baseline.style.cssText='display:inline-block;width:0;height:0;vertical-align:baseline';
  backdrop.append(baseline);const baselineY=baseline.offsetTop;baseline.remove();
  return {top:baselineY-metrics.actualBoundingBoxAscent,bottom:baselineY+metrics.actualBoundingBoxDescent};
}
const motion=matchMedia('(prefers-reduced-motion: reduce)');
let images=[],signature='',active=0,local=false,zoom=1,x=0,y=0,shownX=0,shownY=0,frame=0,drag=null,suppressClick=false;
let layers=[],hull=[],hover=null,idleTimer=0,returning=false,lastFrameTime=0;
const MIN_ZOOM=.7,MAX_ZOOM=1.2;
let entranceState='pending',entranceTimer=0,entranceCleanup=0;
function releaseEntrance(quick=false){
  if(!['waiting','settling'].includes(entranceState))return;
  clearTimeout(entranceTimer);clearTimeout(entranceCleanup);entranceState='settling';
  canvas.classList.remove('entrance-loading');
  for(const {element} of layers){
    element.style.transition=`translate ${motion.matches?0:quick?.45:3.2}s cubic-bezier(.22,1,.36,1), opacity .9s ease`;
    element.style.translate='0px 0px';
  }
  entranceCleanup=setTimeout(()=>{
    for(const {element} of layers){element.style.removeProperty('translate');element.style.removeProperty('transition');}
    entranceState='done';activity();
  },motion.matches?0:quick?450:3200);
}
function prepareEntrance(columns,gap){
  if(entranceState!=='waiting')return;
  const middle=parseFloat(backdrop.style.top);
  for(const column of columns.values()){
    const tiles=column;
    const above=tiles.filter(box=>box.top+box.height/2<middle),below=tiles.filter(box=>box.top+box.height/2>=middle);
    const up=gap*1.25,down=gap*1.25;
    for(const box of above)box.element.style.translate=`0px ${-up}px`;
    for(const box of below)box.element.style.translate=`0px ${down}px`;
  }
}
async function revealCollection(imageTiles,includePanels){
  if(includePanels)panels.forEach(element=>element.classList.add('entrance-text'));
  await Promise.allSettled(imageTiles.map(img=>img.decode()));
  if(imageTiles.some(img=>!img.isConnected))return;
  scheduleLayout();
  // Reveal every photograph and text tile in the same frame, after final layout.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  if(imageTiles.some(img=>!img.isConnected))return;
  imageTiles.forEach(img=>{if(img.naturalWidth)img.classList.add('image-ready');});
  if(includePanels)panels.forEach(element=>element.classList.add('entrance-text-ready'));
  await new Promise(resolve=>setTimeout(resolve,motion.matches?0:900));
}
async function startEntrance(readyImages){
  // Keep the wordmark's clear band until every loaded image finishes fading in.
  await Promise.allSettled(readyImages);
  if(entranceState==='waiting')entranceTimer=setTimeout(()=>releaseEntrance(),250);
}
for(const event of ['pointerdown','wheel','keydown'])document.addEventListener(event,()=>releaseEntrance(true),{capture:true,passive:true});
// Generate a balanced, expanding grid for any collection size; reserve the text tiles.
function imageCells(count){
  const reserved=new Set(['0,0','1,1','-1,1']);
  const radius=Math.ceil(Math.sqrt(count+3));
  const candidates=[];
  for(let row=-radius;row<=radius;row++)for(let col=-radius;col<=radius;col++){
    if(!reserved.has(col+','+row))candidates.push([col,row]);
  }
  return candidates.sort((a,b)=>(a[0]*a[0]+a[1]*a[1])-(b[0]*b[0]+b[1]*b[1])||Math.atan2(a[1],a[0])-Math.atan2(b[1],b[0])).slice(0,count);
}
function activity(){
  clearTimeout(idleTimer);
  if(returning){returning=false;x=shownX;y=shownY;}
  idleTimer=setTimeout(()=>{
    if(entranceState==='waiting'||entranceState==='settling'||dialog.open||drag||document.hidden||contact.matches(':hover')||contact.contains(document.activeElement))return;
    hover=null;returning=true;x=0;y=0;update();
  },2000);
}
for(const event of ['pointermove','pointerdown','pointerup','wheel','keydown'])document.addEventListener(event,activity,{capture:true,passive:true});
dialog.addEventListener('close',activity);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(idleTimer);else activity();});
function layout(preserveCamera=false){
  // Resize and load events can arrive before the first gallery list has rendered any tiles.
  if(!layers.length)return;
  const w=canvas.clientWidth,h=canvas.clientHeight;
  const tileWidth=Math.max(250,Math.min(340,w*.20)),gap=tileWidth*.20;
  panels.forEach(el=>el.style.width=tileWidth+'px');
  const columns=new Map(),cells=imageCells(images.length);
  // Set widths before measuring text, then calculate every position in memory.
  layers.forEach(({element},i)=>{
    if(i<images.length){const img=element.querySelector('img');element.style.width=tileWidth+'px';element.style.height=(img.naturalWidth?tileWidth*img.naturalHeight/img.naturalWidth:tileWidth)+'px';}
  });
  const sizes=layers.map(({element})=>element.offsetHeight),introHeight=intro.offsetHeight,wordmarkHeight=backdrop.offsetHeight;
  const ink=measureWordmark();
  const geometry=new Map();
  layers.forEach((layer,i)=>{
    const {element}=layer;
    const cell=i<images.length?cells[i]:[[0,0],[1,1],[-1,1]][i-images.length];
    const box={element,row:cell[1],left:w/2+cell[0]*(tileWidth+gap)-tileWidth/2,height:sizes[i],top:0};
    geometry.set(element,box);
    if(!columns.has(cell[0]))columns.set(cell[0],[]);
    columns.get(cell[0]).push(box);
  });
  for(const items of columns.values()){
    items.sort((a,b)=>a.row-b.row);
    let middle=items.findIndex(item=>item.row>=0);if(middle<0)middle=items.length-1;
    let top=h/2-introHeight/2;
    items[middle].top=top;
    for(let i=middle-1;i>=0;i--){top-=items[i].height+gap;items[i].top=top;}
    top=items[middle].top+items[middle].height+gap;
    for(let i=middle+1;i<items.length;i++){items[i].top=top;top+=items[i].height+gap;}
  }
  const wordmarkMiddle=geometry.get(intro).top-gap-ink.bottom+wordmarkHeight/2;
  const bandTop=wordmarkMiddle-wordmarkHeight/2+ink.top-gap,bandBottom=wordmarkMiddle-wordmarkHeight/2+ink.bottom+gap;
  // Reserve the title band in the final layout, keeping each column's gutters intact.
  for(const column of columns.values()){
    const above=column.filter(box=>box.top+box.height/2<wordmarkMiddle);
    const below=column.filter(box=>box.top+box.height/2>=wordmarkMiddle);
    const up=Math.max(0,...above.map(box=>box.top+box.height-bandTop));
    const down=Math.max(0,...below.map(box=>bandBottom-box.top));
    for(const box of above)box.top-=up;
    for(const box of below)box.top+=down;
  }
  for(const box of geometry.values()){box.element.style.left=box.left+'px';box.element.style.top=box.top+'px';}
  backdrop.style.left=w/2+'px';backdrop.style.top=wordmarkMiddle+'px';foregroundWordmark.style.left=backdrop.style.left;foregroundWordmark.style.top=backdrop.style.top;
  wordmarkBox={width:backdrop.offsetWidth,height:wordmarkHeight,top:wordmarkMiddle,viewportWidth:w,viewportHeight:h};
  prepareEntrance(columns,gap);
  // Each point is the camera position that centers one real canvas object.
  const points=layers.flatMap(({element,depth})=>{const box=geometry.get(element),d=motion.matches?1:depth,cx=(w/2-box.left-tileWidth/2)/d;const points=[{x:cx,y:(h/2-box.top-box.height/2)/d}];if(panels.includes(element)&&box.height>h-180){points.push({x:cx,y:(100-box.top)/d},{x:cx,y:(h-80-box.top-box.height)/d});}return points;}).sort((a,b)=>a.x-b.x||a.y-b.y);
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const half=pts=>{const result=[];for(const p of pts){while(result.length>1&&cross(result.at(-2),result.at(-1),p)<=0)result.pop();result.push(p);}return result;};
  hull=[...half(points).slice(0,-1),...half([...points].reverse()).slice(0,-1)];
  bounds();if(!preserveCamera){shownX=x;shownY=y;}paint();
}
function scheduleLayout(){if(!layoutFrame)layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;layout(true);});}
const titleOf=name=>name;
function render(items){
  const next=JSON.stringify([activeCollection,items]);if(next===signature)return;signature=next;
  const canEnlarge=activeCollection==='HQ';
  canvas.dataset.collection=activeCollection;
  document.querySelector('.canvas-hint').textContent='Drag to pan · scroll to zoom'+(canEnlarge?' · click to view':'');
  clearTimeout(prefetchTimer);
  const firstCollection=entranceState==='pending'&&items.length>0;
  if(firstCollection)entranceState=motion.matches?'done':'waiting';
  else if(entranceState==='waiting'||entranceState==='settling'){clearTimeout(entranceTimer);clearTimeout(entranceCleanup);entranceState='done';}
  canvas.classList.toggle('entrance-loading',entranceState==='waiting');
  const imageTiles=[];
  const currentName=images[active]?.name;
  images=items.map(i=>({...i,title:titleOf(i.name)}));
  plane.replaceChildren(canvasPaper,backdrop,foregroundWordmark);layers=[];
  images.forEach((item,index)=>{
    const button=document.createElement(canEnlarge?'button':'div');button.className='hero-image';
    if(canEnlarge){button.type='button';button.setAttribute('aria-label',`View ${item.title}`);}else{button.tabIndex=0;}
    const img=document.createElement('img');img.src=item.preview||item.url;img.alt=item.title;img.draggable=false;img.decoding='async';img.addEventListener('load',scheduleLayout);button.append(img);
    if(canEnlarge){
      button.addEventListener('click',()=>{if(!suppressClick)openImage(index);});
      button.addEventListener('pointerenter',()=>{clearTimeout(prefetchTimer);prefetchTimer=setTimeout(()=>prefetch(item),150);});button.addEventListener('pointerleave',()=>clearTimeout(prefetchTimer));button.addEventListener('focus',()=>prefetch(item));
    }
    plane.append(button);layers.push({element:button,depth:1.10});
    imageTiles.push(img);
  });
  panels.forEach((element,index)=>{plane.append(element);layers.push({element,depth:1.10});});
  status.hidden=images.length>0;status.textContent=local?`Your ${activeCollection} collection is empty. Add images to images/${activeCollection} in this project.`:'The collection is being prepared.';
  if(dialog.open){if(!images.length)dialog.close();else{const same=images.findIndex(i=>i.name===currentName);active=same<0?Math.min(active,images.length-1):same;showImage();}}
  layout();
  const reveal=revealCollection(imageTiles,firstCollection||panels.some(element=>!element.classList.contains('entrance-text-ready')));
  if(firstCollection&&entranceState==='waiting')startEntrance([reveal]);
}
// HQ and LQ lists arrive together; the switch in the navigation chooses which one the canvas shows.
const collectionNames=['HQ','LQ'],collectionButtons=[...document.querySelectorAll('[data-collection]')];
let collections={},activeCollection='HQ';
// Shuffle once per page load; the keys persist so refreshes and collection switches keep that order.
const shuffleKeys=new Map();
function shuffled(collection){return (collections[collection]||[]).map(item=>{const key=collection+'/'+item.name;if(!shuffleKeys.has(key))shuffleKeys.set(key,Math.random());return [shuffleKeys.get(key),item];}).sort((a,b)=>a[0]-b[0]).map(([,item])=>item);}
function receive(data){collections=Object.fromEntries(collectionNames.map(name=>[name,Array.isArray(data?.[name])?data[name]:[]]));render(shuffled(activeCollection));}
function selectCollection(name){
  if(name===activeCollection||!collectionNames.includes(name))return;
  activeCollection=name;collectionButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.collection===name)));
  hover=null;returning=false;x=0;y=0;render(shuffled(name));activity();
}
collectionButtons.forEach(button=>button.addEventListener('click',()=>selectCollection(button.dataset.collection)));
async function refresh(){try{const r=await fetch(local?'/api/images':'gallery.json',{cache:'no-store'});if(!r.ok)throw Error();receive(await r.json());}catch{if(!images.length){status.hidden=false;status.textContent='The image collection could not load. Please refresh to try again.';}}}
async function init(){if(['localhost','127.0.0.1','[::1]'].includes(location.hostname))try{const r=await fetch('/api/images',{cache:'no-store'});if(r.ok&&r.headers.get('content-type')?.includes('application/json')){local=true;receive(await r.json());}}catch{}if(!local)await refresh();if(local)setInterval(()=>{if(!document.hidden)refresh();},2000);navigate(location.hash);activity();}
function showImage(){const item=images[active];document.querySelector('#full-image').src=item.url;document.querySelector('#full-image').alt=item.title;document.querySelector('#lightbox-title').textContent=item.title;document.querySelector('#image-number').textContent=`${String(active+1).padStart(2,'0')} / ${String(images.length).padStart(2,'0')}`;document.querySelector('#previous').disabled=images.length<2;document.querySelector('#next').disabled=images.length<2;fullImage.decode().then(()=>{prefetch(images[(active+1)%images.length]);prefetch(images[(active-1+images.length)%images.length]);},()=>{});}
let viewerPhase='closed',queuedClose=false;
const fullImage=document.querySelector('#full-image');
// Full-size photographs load only for the viewer; a resting pointer or a neighbouring image starts them early.
const prefetched=new Map();let prefetchTimer=0;
function prefetch(item){if(!item?.preview||prefetched.has(item.url))return;const image=new Image();image.src=item.url;prefetched.set(item.url,image);}
function imageTile(index){return plane.querySelectorAll('.hero-image')[index];}
function animateViewer(element,keyframes,duration=460){
  const animation=element.animate(keyframes,{duration:motion.matches?0:duration,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
  return animation.finished.catch(()=>{}).then(()=>animation);
}
function imageTransform(from,to){return 'translate('+ (from.left-to.left)+'px,'+(from.top-to.top)+'px) scale('+(from.width/to.width)+','+(from.height/to.height)+')';}
async function openImage(index){
  if(activeCollection!=='HQ'||viewerPhase!=='closed')return;
  viewerPhase='opening';queuedClose=false;clearTimeout(idleTimer);returning=false;hover=null;x=shownX;y=shownY;
  const thumbnail=imageTile(index)?.querySelector('img'),source=thumbnail?.getBoundingClientRect();
  active=index;showImage();fullImage.style.visibility='hidden';dialog.style.background='transparent';dialog.append(cursor);dialog.showModal();
  try{await fullImage.decode();}catch{}
  if(!dialog.open){viewerPhase='closed';fullImage.style.visibility='';return;}
  const destination=fullImage.getBoundingClientRect();
  if(thumbnail)thumbnail.style.visibility='hidden';
  fullImage.style.visibility='';fullImage.style.transformOrigin='0 0';
  const start=source&&source.width&&destination.width?imageTransform(source,destination):'scale(.96)';
  const animations=await Promise.all([
    animateViewer(fullImage,[{transform:start,opacity:source?1:0},{transform:'none',opacity:1}]),
    animateViewer(dialog,[{backgroundColor:'rgba(245,245,240,0)'},{backgroundColor:'rgba(245,245,240,1)'}]),
    ...[...dialog.querySelectorAll('.lightbox-top,.lightbox-bottom')].map(el=>animateViewer(el,[{opacity:0},{opacity:1}],520))
  ]);
  if(thumbnail)thumbnail.style.visibility='';
  dialog.style.background='rgb(245,245,240)';animations.forEach(animation=>animation.cancel());
  viewerPhase='open';if(queuedClose)closeViewer();
}
async function closeViewer(){
  if(viewerPhase==='opening'){queuedClose=true;return;}
  if(viewerPhase!=='open')return;
  viewerPhase='closing';queuedClose=false;
  const tile=imageTile(active),thumbnail=tile?.querySelector('img');
  let target=thumbnail?.getBoundingClientRect();
  // If navigation reached an off-screen image, position its gallery tile behind the viewer first.
  if(tile&&target&&(target.right<0||target.left>innerWidth||target.bottom<0||target.top>innerHeight)){
    const previousZoom=zoom;center(tile);zoom=previousZoom;shownX=x;shownY=y;paint();target=thumbnail.getBoundingClientRect();
  }
  const source=fullImage.getBoundingClientRect();if(thumbnail)thumbnail.style.visibility='hidden';
  fullImage.style.transformOrigin='0 0';
  const end=target&&target.width&&source.width?imageTransform(target,source):'scale(.96)';
  const animations=await Promise.all([
    animateViewer(fullImage,[{transform:'none',opacity:1},{transform:end,opacity:target?1:0}],420),
    animateViewer(dialog,[{backgroundColor:'rgba(245,245,240,1)'},{backgroundColor:'rgba(245,245,240,0)'}],420),
    ...[...dialog.querySelectorAll('.lightbox-top,.lightbox-bottom')].map(el=>animateViewer(el,[{opacity:1},{opacity:0}],180))
  ]);
  dialog.close();if(thumbnail)thumbnail.style.visibility='';animations.forEach(animation=>animation.cancel());
  fullImage.style.transformOrigin='';dialog.style.background='';viewerPhase='closed';canvas.focus({preventScroll:true});activity();
}
function step(amount){if(viewerPhase!=='open')return;active=(active+amount+images.length)%images.length;showImage();const shown=fullImage.src;fullImage.decode().catch(()=>{}).then(()=>{if(fullImage.src===shown)animateViewer(fullImage,[{opacity:0},{opacity:1}],260).then(animation=>animation.cancel());});}
document.querySelector('#close-lightbox').onclick=closeViewer;document.querySelector('#previous').onclick=()=>step(-1);document.querySelector('#next').onclick=()=>step(1);
dialog.addEventListener('cancel',event=>{event.preventDefault();closeViewer();});
dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.classList.contains('lightbox-image'))closeViewer();});
dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}if(e.key==='ArrowRight'){e.preventDefault();step(1);}});
function paint(){
  // All tiles share a depth: move their parent once, retaining wordmark parallax.
  const depth=motion.matches?1:1.10,px=shownX*depth,py=shownY*depth;
  plane.style.transform=`scale(${zoom}) translate3d(${px}px,${py}px,0)`;
  canvasPaper.style.transform=`translate3d(${-px}px,${-py}px,0) scale(${1/zoom})`;
  // Clamp in screen space so the entire title survives every pan and zoom level.
  const {width:ww,height:wh,top:baseY,viewportWidth:w,viewportHeight:h}=wordmarkBox;
  const fit=Math.min(1,(w-32)/(ww*zoom),(h-32)/(wh*zoom));
  const halfW=ww*zoom*fit/2,halfH=wh*zoom*fit/2;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const drift=motion.matches?0:.12;
  const screenX=clamp(w/2+shownX*drift*zoom,16+halfW,w-16-halfW);
  const screenY=clamp(h/2+(baseY-h/2+shownY*drift)*zoom,16+halfH,h-16-halfH);
  const offsetX=(screenX-w/2)/zoom-px,offsetY=(screenY-h/2)/zoom+h/2-baseY-py;
  backdrop.style.transform=`translate(-50%,-50%) translate3d(${offsetX}px,${offsetY}px,0) scale(${fit})`;foregroundWordmark.style.transform=backdrop.style.transform;
  if(paintedZoom!==zoom){
    paintedZoom=zoom;resetButton.textContent=`${Math.round(zoom*100)}%`;
    zoomOutButton.disabled=zoom<=MIN_ZOOM;zoomInButton.disabled=zoom>=MAX_ZOOM;
  }
}
function animate(now=performance.now()){
  frame=0;const dt=lastFrameTime?Math.min(50,now-lastFrameTime):16.67;lastFrameTime=now;
  const ease=motion.matches?1:1-Math.exp(-dt/(returning?1200:drag?42:214));
  shownX+=(x-shownX)*ease;shownY+=(y-shownY)*ease;
  if(Math.abs(x-shownX)<.1)shownX=x;if(Math.abs(y-shownY)<.1)shownY=y;paint();
  if(shownX!==x||shownY!==y)frame=requestAnimationFrame(animate);else{lastFrameTime=0;returning=false;}
}
function update(){if(!frame)frame=requestAnimationFrame(animate);}
function bounds(){
  if(hull.length<3)return;
  let inside=true,nearest=null,distance=Infinity;
  for(let i=0;i<hull.length;i++){
    const a=hull[i],b=hull[(i+1)%hull.length],dx=b.x-a.x,dy=b.y-a.y;
    if(dx*(y-a.y)-dy*(x-a.x)<-.001)inside=false;
    const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)));
    const point={x:a.x+t*dx,y:a.y+t*dy},d=(point.x-x)**2+(point.y-y)**2;
    if(d<distance){distance=d;nearest=point;}
  }
  if(!inside&&nearest){x=nearest.x;y=nearest.y;}
}
function scale(delta){hover=null;zoom=Math.min(MAX_ZOOM,Math.max(MIN_ZOOM,Math.round((zoom+delta)*1000)/1000));bounds();update();}
function reset(){hover=null;x=0;y=0;zoom=1;update();}
document.querySelector('#zoom-in').onclick=()=>scale(.1);document.querySelector('#zoom-out').onclick=()=>scale(-.1);document.querySelector('#reset').onclick=reset;
canvas.addEventListener('pointerdown',e=>{
  // Only the click that ends a drag is suppressed; every new press, including on Team controls, starts fresh.
  if(!drag)suppressClick=false;
  if(e.target.closest('#team')||e.button!==0||drag)return;hover=null;x=shownX;y=shownY;
  drag={id:e.pointerId,px:e.clientX,py:e.clientY,x,y};
  // Prevent native image dragging and focus-induced scrolling of clipped images.
  if(!e.target.closest('a'))e.preventDefault();
});
canvas.addEventListener('pointermove',e=>{
  if(!drag){
    if(entranceState==='waiting'||entranceState==='settling'){hover=null;return;}
    if(e.target.closest('#team')){hover=null;return;}
    if(e.pointerType!=='mouse'||e.buttons||dialog.open||motion.matches)return;
    if(hover){const dx=e.clientX-hover.x,dy=e.clientY-hover.y;const strength=.55*(1-.5*(zoom-MIN_ZOOM)/(MAX_ZOOM-MIN_ZOOM));x-=dx*strength/zoom;y-=dy*strength/zoom;bounds();update();}
    hover={x:e.clientX,y:e.clientY};return;
  }
  if(e.pointerId!==drag.id)return;
  const dx=e.clientX-drag.px,dy=e.clientY-drag.py;
  if(!suppressClick&&Math.hypot(dx,dy)<5)return;
  suppressClick=true;canvas.classList.add('dragging');
  if(!canvas.hasPointerCapture(e.pointerId))canvas.setPointerCapture(e.pointerId);
  x=drag.x+dx/zoom;y=drag.y+dy/zoom;bounds();update();
});
function endDrag(e){hover=null;if(!drag||(e.pointerId!==undefined&&e.pointerId!==drag.id))return;const id=drag.id;drag=null;canvas.classList.remove('dragging');if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}
canvas.addEventListener('pointerleave',()=>{hover=null;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){endDrag({});x=shownX;y=shownY;}});
window.addEventListener('pointerup',endDrag);window.addEventListener('pointercancel',endDrag);window.addEventListener('blur',()=>endDrag({}));
canvas.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
canvas.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey)return;e.preventDefault();scale(-Math.sign(e.deltaY)*.035);},{passive:false});
canvas.addEventListener('keydown',e=>{
  if(e.key==='Enter'||e.key===' ')suppressClick=false;
  if(e.target.closest('a,#team'))return;
  const offsets={ArrowLeft:[120,0],ArrowRight:[-120,0],ArrowUp:[0,120],ArrowDown:[0,-120]};
  if(offsets[e.key]){e.preventDefault();x+=offsets[e.key][0]/zoom;y+=offsets[e.key][1]/zoom;bounds();update();}
  if(e.key==='+'||e.key==='='){e.preventDefault();scale(.1);}if(e.key==='-'){e.preventDefault();scale(-.1);}if(e.key==='Home'){e.preventDefault();reset();}
});
function center(element){hover=null;const layer=layers.find(l=>l.element===element);if(!layer)return;zoom=1;const d=motion.matches?1:layer.depth;x=(canvas.clientWidth/2-element.offsetLeft-element.offsetWidth/2)/d;y=(element.offsetHeight>canvas.clientHeight-180?100-element.offsetTop:canvas.clientHeight/2-element.offsetTop-element.offsetHeight/2)/d;bounds();update();}
function navigate(hash){if(hash==='#about'||hash==='#studio')center(studio);else if(hash==='#team'||hash==='#contact')center(contact);else reset();}
document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',e=>{e.preventDefault();const hash=link.getAttribute('href');history.replaceState(null,'',hash);navigate(hash);if(link.classList.contains('skip'))canvas.focus({preventScroll:true});}));
window.addEventListener('hashchange',()=>navigate(location.hash));
canvas.addEventListener('focusin',e=>{if(e.target.matches('.hero-image')&&!drag&&viewerPhase==='closed')center(e.target);});
window.addEventListener('resize',()=>{endDrag({});layout();navigate(location.hash);});
motion.addEventListener('change',()=>{hover=null;layout();update();});
init();

// Reparent the cursor into the modal top layer so it remains visible in the viewer.
const cursor=document.createElement('div');
cursor.className='inverting-cursor';cursor.setAttribute('aria-hidden','true');document.body.append(cursor);
const finePointer=matchMedia('(any-hover: hover) and (any-pointer: fine)');
let cursorFrame=0,cursorX=0,cursorY=0,cursorVisible=false;
function hideCursor(){if(cursorFrame){cancelAnimationFrame(cursorFrame);cursorFrame=0;}cursorVisible=false;document.body.classList.remove('custom-cursor-active');}
document.addEventListener('pointermove',event=>{
  if(event.pointerType!=='mouse'||!finePointer.matches){hideCursor();return;}
  cursorX=event.clientX;cursorY=event.clientY;
  if(!cursorFrame)cursorFrame=requestAnimationFrame(()=>{
    cursorFrame=0;cursor.style.transform=`translate3d(${cursorX}px,${cursorY}px,0) translate(-50%,-50%)`;
    if(!cursorVisible){cursorVisible=true;document.body.classList.add('custom-cursor-active');}
  });
},{passive:true,capture:true});
document.documentElement.addEventListener('pointerleave',hideCursor);
window.addEventListener('blur',hideCursor);
document.addEventListener('visibilitychange',()=>{if(document.hidden)hideCursor();});
finePointer.addEventListener('change',hideCursor);
dialog.addEventListener('close',()=>document.body.append(cursor));



// Hover disclosures keep their full content inside the hover target.
let teamPointerType='mouse';
const teamEntries=[...contact.querySelectorAll('.team-entry')];
const teamCloseTimers=new WeakMap();
function setTeamOpen(entry,open){
  clearTimeout(teamCloseTimers.get(entry));teamCloseTimers.delete(entry);
  const button=entry.querySelector('.team-trigger'),details=entry.querySelector('.team-details');
  if(button.getAttribute('aria-expanded')===String(open))return;
  button.setAttribute('aria-expanded',String(open));details.setAttribute('aria-hidden',String(!open));details.inert=!open;
  entry.classList.toggle('is-open',open);
}
function delayTeamClose(entry){
  clearTimeout(teamCloseTimers.get(entry));
  teamCloseTimers.set(entry,setTimeout(()=>setTeamOpen(entry,false),1000));
}
function holdTeam(){clearTimeout(idleTimer);returning=false;hover=null;x=shownX;y=shownY;}
contact.addEventListener('pointerenter',holdTeam);
contact.addEventListener('pointerleave',()=>{hover=null;activity();});
contact.addEventListener('pointerdown',e=>{teamPointerType=e.pointerType;holdTeam();});
for(const entry of teamEntries){
  const button=entry.querySelector('.team-trigger');
  entry.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&!drag){holdTeam();setTeamOpen(entry,true);}});
  entry.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')delayTeamClose(entry);});
  button.addEventListener('click',e=>{holdTeam();if(e.detail===0||teamPointerType!=='mouse')setTeamOpen(entry,button.getAttribute('aria-expanded')!=='true');else setTeamOpen(entry,true);});
  entry.addEventListener('keydown',e=>{if(e.key==='Escape'){setTeamOpen(entry,false);button.focus({preventScroll:true});e.stopPropagation();}});
  entry.addEventListener('focusin',()=>{clearTimeout(teamCloseTimers.get(entry));teamCloseTimers.delete(entry);});
  entry.addEventListener('focusout',e=>{if(!entry.contains(e.relatedTarget)&&!entry.matches(':hover'))delayTeamClose(entry);activity();});
}
// Measure each animation step so only subsequent tiles in this column are pushed down.
new ResizeObserver(scheduleLayout).observe(contact);
// The wordmark uses Arial Black where installed, otherwise the bundled lookalike with its own spacing.
// The title band is measured from the glyphs, so lay out again once the font in use is ready.
if(document.fonts)document.fonts.load('900 100px "Wordmark Arial Black"').then(faces=>faces.some(face=>face.status==='loaded'),()=>false).then(local=>{
  for(const mark of [backdrop,foregroundWordmark])mark.classList.toggle('wordmark-fallback',!local);
  return local||document.fonts.load('900 100px "Wordmark Archivo Black"');
}).catch(()=>{}).then(scheduleLayout);






