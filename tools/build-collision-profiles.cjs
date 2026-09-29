/* Offline alpha geometry extraction. Re-run only after replacing the world atlases. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),CELL=128;
function png(file){
  const data=fs.readFileSync(file),parts=[];let width,height,type,depth;
  for(let offset=8;offset<data.length;){const length=data.readUInt32BE(offset),kind=data.toString('ascii',offset+4,offset+8),bytes=data.subarray(offset+8,offset+8+length);if(kind==='IHDR'){width=bytes.readUInt32BE(0);height=bytes.readUInt32BE(4);depth=bytes[8];type=bytes[9];}if(kind==='IDAT')parts.push(bytes);offset+=length+12;}
  if(type!==6||depth!==8)throw new Error('Atlas must be an 8-bit RGBA PNG: '+file);
  const packed=zlib.inflateSync(Buffer.concat(parts)),stride=width*4,pixels=Buffer.alloc(stride*height);let p=0;
  const paeth=(a,b,c)=>{const n=a+b-c,x=Math.abs(n-a),y=Math.abs(n-b),z=Math.abs(n-c);return x<=y&&x<=z?a:y<=z?b:c;};
  for(let y=0;y<height;y++){const filter=packed[p++],row=y*stride;for(let x=0;x<stride;x++){const a=x>=4?pixels[row+x-4]:0,b=y?pixels[row+x-stride]:0,c=y&&x>=4?pixels[row+x-stride-4]:0,n=packed[p++];pixels[row+x]=(n+(filter===1?a:filter===2?b:filter===3?(a+b)>>1:filter===4?paeth(a,b,c):0))&255;}}
  return{width,height,pixels};
}
function components(mask){const seen=new Uint8Array(CELL*CELL),groups=[];for(let i=0;i<mask.length;i++){if(!mask[i]||seen[i])continue;const group=[],queue=[i];seen[i]=1;for(let q=0;q<queue.length;q++){const at=queue[q],x=at%CELL,y=Math.floor(at/CELL);group.push([x,y]);for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){const nx=x+dx,ny=y+dy,k=ny*CELL+nx;if(nx>=0&&nx<CELL&&ny>=0&&ny<CELL&&mask[k]&&!seen[k]){seen[k]=1;queue.push(k);}}}groups.push(group);}return groups.sort((a,b)=>b.length-a.length);}
function hull(points){
  points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const unique=points.filter((p,i)=>!i||p[0]!==points[i-1][0]||p[1]!==points[i-1][1]);
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const low=[],high=[];for(const p of unique){while(low.length>1&&cross(low.at(-2),low.at(-1),p)<=0)low.pop();low.push(p);}for(let i=unique.length-1;i>=0;i--){const p=unique[i];while(high.length>1&&cross(high.at(-2),high.at(-1),p)<=0)high.pop();high.push(p);}low.pop();high.pop();return low.concat(high);
}
const trees=new Set([...Array.from({length:49},(_,i)=>i),140,141,163,164,165,166,167,168,169,179]);
const openings={nature:new Set([51,61,128,131,184]),furniture:new Set([131,132])};
function profile(atlas,sheet,index){
  const mask=new Uint8Array(CELL*CELL),ox=index%14*CELL,oy=Math.floor(index/14)*CELL;
  for(let y=0;y<CELL;y++)for(let x=0;x<CELL;x++)mask[y*CELL+x]=atlas.pixels[((oy+y)*atlas.width+ox+x)*4+3]>=128?1:0;
  const groups=components(mask),minimum=Math.max(10,(groups[0]?.length||0)*.012),keep=groups.filter(g=>g.length>=minimum).flat();
  if(!keep.length)return null;
  mask.fill(0);for(const [x,y]of keep)mask[y*CELL+x]=1;
  const xs=keep.map(p=>p[0]),ys=keep.map(p=>p[1]),bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs)+1,Math.max(...ys)+1];
  const spriteHeight=bounds[3]-bounds[1],tree=sheet==='nature'&&trees.has(index),depth=Math.max(7,Math.min(22,Math.round(spriteHeight*(tree ? .09 : .20)))),baseY=bounds[3]-depth/2,visualHeight=baseY-bounds[1];
  let height=visualHeight;
  if(tree){
    const widths=[];for(let y=Math.max(bounds[1],bounds[3]-depth*2);y<bounds[3]-depth*.5;y++){const rowXs=[];for(let x=bounds[0];x<bounds[2];x++)if(mask[y*CELL+x])rowXs.push(x);if(rowXs.length)widths.push(rowXs.at(-1)-rowXs[0]);}
    widths.sort((a,b)=>a-b);const woodWidth=Math.max(6,widths[Math.floor(widths.length*.25)]||12),leafWidth=Math.max(woodWidth*1.65,(bounds[2]-bounds[0])*.38);
    let broadRows=0;
    for(let y=Math.floor(baseY-depth);y>=bounds[1];y--){let left=CELL,right=-1;for(let x=bounds[0];x<bounds[2];x++)if(mask[y*CELL+x]){left=Math.min(left,x);right=Math.max(right,x);}broadRows=right-left>leafWidth?broadRows+1:0;if(broadRows>=3){height=Math.max(depth,baseY-(y+2));break;}}
  }
  function band(row,bandDepth,split=false){
    const low=Math.max(bounds[1],Math.floor(row-bandDepth/2)),high=Math.min(bounds[3]-1,Math.ceil(row+bandDepth/2)),sub=new Uint8Array(mask.length);
    for(let y=low;y<=high;y++)for(let x=bounds[0];x<bounds[2];x++)sub[y*CELL+x]=mask[y*CELL+x];
    let pieces=split?components(sub).filter(g=>g.length>=Math.max(8,bandDepth*2)):[components(sub).flat()];
    if(tree){
      // Isolate the visible wood directly above the foot, excluding the broad
      // leaf/shadow fringe at the very bottom of the image.
      const samples=[];for(let y=Math.max(bounds[1],bounds[3]-depth*2);y<bounds[3]-depth*.5;y++){const rowXs=[];for(let x=bounds[0];x<bounds[2];x++)if(mask[y*CELL+x])rowXs.push(x);if(rowXs.length)samples.push([rowXs[0],rowXs.at(-1)]);}
      samples.sort((a,b)=>(a[1]-a[0])-(b[1]-b[0]));const wood=samples[Math.floor(samples.length*.25)];
      if(wood){const center=(wood[0]+wood[1])/2,half=Math.max(3,Math.min((wood[1]-wood[0])/2,(bounds[2]-bounds[0])*.19));pieces=pieces.map(g=>g.filter(([x])=>x>=center-half&&x<=center+half));}
    }
    return pieces.map(g=>hull(g).map(([x,y])=>[Math.round((x-CELL/2)*100)/100,Math.round((y-row)*100)/100])).filter(p=>p.length>=3);
  }
  const split=openings[sheet].has(index),base=band(baseY,depth,split),levels=[];
  const count=tree?1:7;
  for(let i=0;i<count;i++){const min=i/count*height,max=(i+1)/count*height,mid=i?((min+max)/2):0,parts=band(baseY-mid,depth,split);if(parts.length)levels.push({min:Math.round(min*100)/100,max:Math.round(max*100)/100,parts});}
  return{bounds,baseY:Math.round(baseY*100)/100,height:Math.round(height*100)/100,visualHeight:Math.round(visualHeight*100)/100,base,levels,tree,opening:split};
}
const result={cell:CELL,sheets:{}};
for(const sheet of ['nature','furniture']){const atlas=png(path.join(root,'public','assets','world-kit',sheet+'-14x14.png'));result.sheets[sheet]=Array.from({length:196},(_,i)=>profile(atlas,sheet,i));}
const source='/* Generated from the alpha pixels of the shipped world-kit atlases. */\n(function(root,factory){if(typeof module===\'object\'&&module.exports)module.exports=factory();else root.UZSceneryProfiles=factory();})(typeof globalThis!==\'undefined\'?globalThis:this,function(){return '+JSON.stringify(result)+';});\n';
fs.writeFileSync(path.join(root,'shared','scenery-profiles.js'),source);console.log('Wrote alpha geometry for 392 world sprites.');
