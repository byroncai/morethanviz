import {readdir,writeFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const source=path.join(root,'images');
const collections=['HQ','LQ'];
async function imageNames(folder){
  return (await readdir(folder,{withFileTypes:true})).filter(e=>e.isFile()&&/\.(jpe?g|png|webp|avif|gif)$/i.test(e.name)).map(e=>e.name).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
}
const gallery={};
for(const collection of collections){
  const names=await imageNames(path.join(source,collection));
  let previewNames=[];
  try{previewNames=await imageNames(path.join(source,'previews',collection));}catch(error){if(error.code!=='ENOENT')throw error;}
  const previews=new Set(previewNames);
  gallery[collection]=names.map(name=>({name,url:`images/${collection}/${encodeURIComponent(name)}`,...(previews.has(name)?{preview:`images/previews/${collection}/${encodeURIComponent(name)}`}:{})}));
}
for(const file of ['index.html','styles.css','app.js'])await access(path.join(root,file));
await writeFile(path.join(root,'gallery.json'),JSON.stringify(gallery,null,2)+'\n');
console.log(`Static site ready at the project root: ${collections.map(c=>`${gallery[c].length} ${c}`).join(' and ')} images. Commit gallery.json and images/ with the site.`);
