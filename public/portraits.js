'use strict';
(()=>{
const names=['goku','piccolo','krillin','buu','vegeta','bulma','roshi','frieza','cell','dabura','trunks','dende'],images=new Map(),pending=new Map();
const source=skin=>names.includes(skin)?'/assets/portraits/'+skin+'.png':null;
for(const skin of names){const im=new Image();im.onload=()=>{for(const [canvas,selected]of pending)if(selected===skin){window.UZPortrait.canvas(canvas,skin);pending.delete(canvas);}window.dispatchEvent(new Event('portrait-ready'));};im.src=source(skin);images.set(skin,im);}
window.UZPortrait={source,origin:id=>source(({saiyan:'goku',earthling:'krillin',namekian:'piccolo',majin:'buu'})[id]),
 draw(c,skin,x,y,w,h){const im=images.get(skin);if(!im?.naturalWidth)return false;c.save();c.beginPath();c.rect(x,y,w,h);c.clip();const side=Math.min(w,h);c.fillStyle='#06162d';c.fillRect(x,y,w,h);c.drawImage(im,x+(w-side)/2,y+(h-side)/2,side,side);c.restore();return true;},
 canvas(canvas,skin){if(!source(skin))return false;const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);if(!this.draw(c,skin,0,0,canvas.width,canvas.height))pending.set(canvas,skin);return true;}
};
})();
