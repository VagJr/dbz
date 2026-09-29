"use strict";
const Physics = require("../shared/physics");
function cover(engine,e,x=e.x,y=e.y) {
  return engine.physicsColliders ? engine.physicsColliders(e,x,y) : Physics.colliders(e.world,x,y);
}
function collision(engine,e,x,y,pad=Physics.body(e).radius) {
  return Physics.blocked(e,x,y,cover(engine,e,x,y),pad);
}
function sight(engine,a,b) {
  if(a.world!==b.world)return false;
  if(a.world==="space")return true;
  return Physics.sight(a,b,cover(engine,a,(a.x+b.x)/2,(a.y+b.y)/2));
}
module.exports = (Engine) => {
  Engine.prototype.clearSight = function(a,b) {return sight(this,a,b);};
  Engine.prototype.move = function(e,dx,dy) {
    Physics.move(e,dx,dy,cover(this,e));
    e.physicsMovedAt=this.time;
  };
  Engine.prototype.tacticalStep = function(e,target,desired,dt,speed) {
    Physics.ensure(e);
    const strength=Math.min(1,Math.hypot(desired.x,desired.y));
    const weight=Math.sqrt(Physics.body(e).mass/80), blend=1-Math.exp(-18*dt/weight);
    if(strength<.04) {e.vx*=Math.exp(-12*dt);e.vy*=Math.exp(-12*dt);return;}
    speed*=strength;
    const angle=Math.atan2(desired.y,desired.x), look=Physics.body(e).radius+42;
    for(const offset of [0,e.ai?.orbit*.55||.55,-(e.ai?.orbit*.55||.55),1.2,-1.2,Math.PI/2,-Math.PI/2]) {
      const a=angle+offset,x=Math.cos(a),y=Math.sin(a);
      if(collision(this,e,e.x+x*look,e.y+y*look))continue;
      e.vx+=(x*speed-e.vx)*blend;e.vy+=(y*speed-e.vy)*blend;
      this.move(e,e.vx*dt,e.vy*dt);
      return;
    }
    e.vx*=Math.exp(-16*dt);e.vy*=Math.exp(-16*dt);
  };
};
module.exports.collision=collision;
module.exports.sight=sight;
