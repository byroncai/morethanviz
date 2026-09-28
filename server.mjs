import http from 'node:http';
import {readdir,readFile,stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const publicRoot=root;
const imageRoot=process.env.RAMKA_IMAGES||path.join(root,'images');
const allowed=/\.(jpe?g|png|webp|avif|gif)$/i;
const types={'.woff2':'font/woff2','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.avif':'image/avif','.gif':'image/gif','.svg':'image/svg+xml'};
const inside=(base,file)=>file===base||file.startsWith(base+path.sep);
// Full images live in images/HQ and images/LQ; optional grid previews share their filenames under images/previews.
const collections=['HQ','LQ'];
const imagePath=relative=>{const parts=relative.split('/'),name=parts.at(-1);return (parts.length===2||(parts.length===3&&parts[0]==='previews'))&&collections.includes(parts.at(-2))&&allowed.test(name)&&name===path.basename(name);};
async function imageNames(folder){try{return (await readdir(folder,{withFileTypes:true})).filter(e=>e.isFile()&&allowed.test(e.name)).map(e=>e.name);}catch(error){if(error.code==='ENOENT')return [];throw error;}}
async function imageUrl(parts){const s=await stat(path.join(imageRoot,...parts));return `/local-images/${parts.map(encodeURIComponent).join('/')}?v=${s.mtimeMs}-${s.size}`;}
export async function listImages(){const result={};for(const collection of collections){const names=(await imageNames(path.join(imageRoot,collection))).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));const previews=new Set(await imageNames(path.join(imageRoot,'previews',collection)));result[collection]=await Promise.all(names.map(async name=>({name,url:await imageUrl([collection,name]),...(previews.has(name)?{preview:await imageUrl(['previews',collection,name])}:{})})));}return result;}
const server=http.createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'self'; frame-ancestors 'none'");if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}try{const url=new URL(req.url,'http://localhost');if(url.pathname==='/api/images'){const data=JSON.stringify(await listImages());res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:data);return;}const isImage=url.pathname.startsWith('/local-images/');const base=isImage?imageRoot:publicRoot;const relative=decodeURIComponent(isImage?url.pathname.slice(14):url.pathname.slice(1))||'index.html';if(!isImage&&!['index.html','styles.css','app.js','gallery.json'].includes(relative)&&!relative.startsWith('fonts/')&&!relative.startsWith('images/')){res.writeHead(404);res.end();return;}if(isImage&&!imagePath(relative)){res.writeHead(404);res.end();return;}const file=path.resolve(base,relative);if(!inside(path.resolve(base),file)){res.writeHead(403);res.end();return;}const actual=await realpath(file),actualBase=await realpath(base);if(!inside(actualBase,actual)){res.writeHead(403);res.end();return;}const data=await readFile(actual);res.writeHead(200,{'Content-Type':types[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':isImage?'private, max-age=0, must-revalidate':'no-cache'});res.end(req.method==='HEAD'?undefined:data);}catch(error){res.writeHead(error.code==='ENOENT'?404:500,{'Content-Type':'text/plain'});res.end(error.code==='ENOENT'?'Not found':'Unable to read the image collection. Check the configured folder.');}});
server.listen(Number(process.env.PORT)||4173,'127.0.0.1',()=>console.log('MORETHANVIZ is ready on the configured localhost port — images: '+imageRoot));
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port 4173 is in use. Close the other copy or set PORT.':error.message);process.exitCode=1;});


