"use strict";
// Authored pose families shared by every miniature, selected from actual controls.
module.exports=function motion(e,key,sequence,input=e.input||{}){
 const airborne=e.mode==='flight',moving=Math.hypot(input.x||0,input.y||0)>.1,
 boosted=!!input.boost,forward=(input.x||0)*Math.cos(e.angle)+(input.y||0)*Math.sin(e.angle),
 side=sequence%2?1:-1;
 let pose;
 if(key==='heavy')pose=airborne?'meteor':'uppercut';
 else if(key==='finisher')pose=airborne?'airSpin':'roundhouse';
 else if(boosted&&moving)pose='lunge';
 else if(airborne)pose=['airJab','airCross','airKnee'][sequence%3];
 else if(moving)pose=forward>.3?'stepJab':forward<-.3?'retreatJab':'slipHook';
 else pose=['jab','cross','hook','uppercut'][sequence%4];
 return {pose,side,moving,boosted,airborne,sequence};
};
