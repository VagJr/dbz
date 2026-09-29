/* The supplied sheets are cropped in their original coordinate system.
   SVG keeps one uniform scale for each plate, including its transparent edges. */
(() => {
  const ns = 'http://www.w3.org/2000/svg';
  const sheet = '/hud-reference/' + encodeURIComponent('Imagem do ChatGPT 28 de set. de 2026, 21_53_46-2.png');
  function plate(parent, name, crop, shapes) {
    if (!parent) return;
    const svg = document.createElementNS(ns, 'svg');
    svg.classList.add('hud-precision-art');
    svg.setAttribute('viewBox', `0 0 ${crop[2]} ${crop[3]}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('aria-hidden', 'true');
    const defs = document.createElementNS(ns, 'defs');
    const clip = document.createElementNS(ns, 'clipPath');
    clip.id = 'hud-crop-' + name;
    for (const [tag, attrs] of shapes) {
      const shape = document.createElementNS(ns, tag);
      for (const [key, value] of Object.entries(attrs)) shape.setAttribute(key, value);
      clip.append(shape);
    }
    defs.append(clip);
    const picture = document.createElementNS(ns, 'image');
    picture.setAttribute('href', sheet);
    picture.setAttribute('x', -crop[0]);
    picture.setAttribute('y', -crop[1]);
    picture.setAttribute('width', 941);
    picture.setAttribute('height', 1672);
    picture.setAttribute('clip-path', `url(#${clip.id})`);
    svg.append(defs, picture);
    parent.append(svg);
  }
  plate(document.querySelector('#hud .radar-card'), 'radar', [605, 203, 290, 294], [
    ['circle', {cx: 145, cy: 146, r: 144}],
  ]);
  const circles = [[191,89,90],[70,178,64],[306,180,64],[190,276,94],
    [71,378,64],[311,378,64],[190,432,67]];
  const masks = circles.map(([cx,cy,r]) => ['circle', {cx,cy,r}]);
  // Keep the little name plates, excluding the item slots beside the controls.
  for (const [x,y,width,height] of [[129,153,126,28],[24,230,94,25],
    [260,232,94,25],[141,354,105,28],[26,427,93,27],
    [265,429,96,27],[143,471,100,21]]) masks.push(['rect',{x,y,width,height}]);
  plate(document.querySelector('#hud .action-dock'), 'controls', [567,1107,374,493], masks);
})();
