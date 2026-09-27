const fs=require('fs');const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
edit('tests/frontiers.test.js',s=>s.replace("if(o.type==='travel')p.world=o.target;","if(o.type==='travel'){p.world=o.target;if(!p.visited.includes(o.target))p.visited.push(o.target);}"));
edit('src/quests.js',s=>s.replace('if (o.type === "survive") return p.world === world && this.time - state.objectiveStartedAt >= Math.max(1, Number(o.seconds) || 1);',`if (o.type === "survive") {const marker=markerFor(o);const inside=p.world===world&&(!marker||Math.hypot(p.x-marker.x,p.y-marker.y)<=(o.radius||marker.radius));if(!inside){state.objectiveStartedAt=this.time;return false;}return this.time-state.objectiveStartedAt>=Math.max(1,Number(o.seconds)||1);}`));
// Place troops clear of solid authored props even when formations interleave.
edit('shared/open-world.js',s=>s.replace("return{key:id+':'+cx+':'+cy",`for(const e of enemies){let tries=0;while(props.some(p=>Math.hypot(e.x-p.x,e.y-p.y)<p.size*.5+55)&&tries++<12)e.y+=95;}
    return{key:id+':'+cx+':'+cy`));
