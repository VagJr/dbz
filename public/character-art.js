/* Articulated overhead vector rigs. All catalogue skins have explicit model sheets. */
(() => {
  const TAU = Math.PI * 2,
    outline = "#101c2a";
  const forms = {
    gold: ["#ffdf63", "#ffdb46"],
    blue: ["#61d6f2", "#4dcfff"],
    silver: ["#ebf7ff", "#afdfff"],
    violet: ["#e3ddff", "#bf95ff"],
    purple: ["#a88aed", "#976af3"],
    green: ["#b6ee67", "#9bea4d"],
    black: ["#e1c6ef", "#ad83d6"],
  };
  function path(c, points, fill, stroke = outline, width = 1.6) {
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = width;
      c.stroke();
    }
  }
  function oval(c, x, y, rx, ry, fill, stroke = outline, width = 1.3) {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, TAU);
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = width;
      c.stroke();
    }
  }
  function line(c, points, color, width) {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
  }
  function tube(c, points, color, width) {
    line(c, points, outline, width + 2.6);
    line(c, points, color, width);
    line(
      c,
      points.map(([x, y]) => [x, y - 1]),
      "#ffffff22",
      width * 0.28,
    );
  }
  const cuts = {
    spike: [
      [-3, -11],
      [-13, -19],
      [-9, -6],
      [-24, -9],
      [-15, 0],
      [-26, 8],
      [-13, 9],
      [-16, 21],
      [-4, 12],
      [3, 19],
      [5, 10],
      [11, 8],
      [7, 1],
      [13, -6],
      [3, -7],
    ],
    crest: [
      [-7, -12],
      [-18, -15],
      [-14, -7],
      [-25, 0],
      [-14, 7],
      [-18, 15],
      [-7, 12],
      [6, 10],
      [13, 6],
      [5, 0],
      [13, -6],
      [6, -10],
    ],
    short: [
      [-7, -10],
      [-17, -13],
      [-13, -4],
      [-21, 1],
      [-12, 7],
      [-12, 13],
      [1, 11],
      [11, 6],
      [5, 0],
      [12, -5],
      [3, -10],
    ],
    wild: [
      [-4, -12],
      [-18, -22],
      [-14, -9],
      [-29, -13],
      [-21, -1],
      [-33, 5],
      [-17, 10],
      [-21, 22],
      [-7, 14],
      [1, 22],
      [7, 10],
      [13, 6],
      [8, -2],
      [12, -9],
    ],
    part: [
      [-5, -12],
      [-15, -8],
      [-19, 0],
      [-13, 12],
      [1, 14],
      [11, 9],
      [5, 3],
      [-3, 1],
      [8, -2],
      [13, -8],
      [5, -13],
    ],
    bob: [
      [-7, -13],
      [-17, -10],
      [-20, 0],
      [-17, 13],
      [2, 15],
      [12, 8],
      [5, 5],
      [1, 0],
      [8, -5],
      [12, -10],
      [2, -14],
    ],
    mane: [
      [-4, -12],
      [-24, -17],
      [-34, -8],
      [-29, -3],
      [-43, 6],
      [-26, 10],
      [-26, 21],
      [-10, 16],
      [5, 11],
      [12, 7],
      [5, 0],
      [12, -7],
    ],
    pony: [
      [-9, -11],
      [-17, -8],
      [-22, 0],
      [-17, 10],
      [-7, 13],
      [5, 10],
      [10, 5],
      [7, -5],
      [2, -11],
    ],
    braid: [
      [-7, -11],
      [-15, -7],
      [-18, 0],
      [-13, 11],
      [3, 11],
      [11, 6],
      [6, -5],
      [0, -11],
    ],
    bun: [
      [-6, -12],
      [-17, -8],
      [-20, 1],
      [-12, 12],
      [3, 11],
      [11, 6],
      [5, -6],
      [1, -11],
    ],
  };
  // Compact crown silhouettes for the overhead combat camera; the profile cutouts above are reserved for portraits.
  const overheadHair = {
    spike: [
      [5, -6],
      [3, -13],
      [9, -11],
      [10, -19],
      [15, -13],
      [20, -16],
      [19, -9],
      [26, -7],
      [22, -2],
      [29, 0],
      [23, 4],
      [26, 10],
      [18, 9],
      [16, 16],
      [11, 12],
      [8, 17],
      [8, 9],
      [3, 7],
      [7, 2],
      [4, -2],
      [9, -4],
    ],
    crest: [
      [6, -8],
      [4, -13],
      [12, -11],
      [16, -18],
      [19, -11],
      [25, -8],
      [22, -2],
      [27, 2],
      [19, 4],
      [16, 11],
      [11, 8],
      [7, 11],
      [9, 3],
      [4, 0],
      [8, -3],
    ],
    short: [
      [7, -7],
      [4, -11],
      [11, -10],
      [14, -14],
      [18, -10],
      [23, -8],
      [21, -2],
      [25, 1],
      [19, 3],
      [17, 9],
      [12, 8],
      [7, 10],
      [9, 3],
      [4, 0],
    ],
    wild: [
      [5, -6],
      [1, -14],
      [9, -11],
      [7, -20],
      [14, -13],
      [20, -19],
      [19, -10],
      [28, -11],
      [23, -3],
      [30, 1],
      [22, 4],
      [26, 13],
      [18, 9],
      [15, 18],
      [11, 12],
      [8, 18],
      [8, 9],
      [2, 12],
      [7, 3],
      [3, -1],
      [9, -4],
    ],
    part: [
      [6, -8],
      [5, -14],
      [13, -12],
      [20, -15],
      [21, -9],
      [26, -5],
      [22, -1],
      [26, 4],
      [18, 9],
      [11, 10],
      [6, 7],
      [8, 2],
      [4, -1],
      [9, -3],
    ],
    bob: [
      [6, -9],
      [4, -13],
      [14, -12],
      [21, -8],
      [24, -2],
      [23, 7],
      [18, 11],
      [10, 10],
      [5, 6],
      [7, 1],
      [4, -3],
    ],
    mane: [
      [6, -8],
      [0, -14],
      [10, -13],
      [7, -22],
      [16, -15],
      [21, -20],
      [21, -10],
      [29, -13],
      [25, -4],
      [32, 0],
      [24, 5],
      [28, 13],
      [18, 10],
      [15, 18],
      [10, 13],
      [7, 17],
      [6, 8],
      [1, 11],
      [7, 2],
      [3, -2],
    ],
    pony: [
      [7, -8],
      [4, -13],
      [13, -11],
      [20, -13],
      [23, -7],
      [21, 1],
      [17, 7],
      [10, 9],
      [5, 5],
      [8, 0],
    ],
    braid: [
      [7, -8],
      [5, -12],
      [14, -12],
      [21, -7],
      [21, 1],
      [17, 7],
      [9, 9],
      [5, 4],
      [8, 0],
    ],
    bun: [
      [7, -8],
      [4, -12],
      [14, -12],
      [21, -7],
      [21, 1],
      [16, 7],
      [9, 9],
      [5, 4],
      [8, 0],
    ],
  };
  function energy(c, e, t, power, reduced) {
    const aura = e.form
      ? (forms[e.form] || forms.gold)[1]
      : e.equipped === "galick"
        ? "#c88bff"
        : "#81e8ff";
    c.save();
    c.globalCompositeOperation = "lighter";
    const radius = 38 + power * 22,
      g = c.createRadialGradient(0, 0, 8, 0, 0, radius);
    g.addColorStop(0, aura + "60");
    g.addColorStop(1, aura + "00");
    c.fillStyle = g;
    c.fillRect(-radius, -radius, radius * 2, radius * 2);
    for (let i = 0; i < 3; i++) {
      const f = reduced ? i / 3 : (t * 1.7 + i / 3) % 1;
      c.globalAlpha = (1 - f) * 0.48;
      c.strokeStyle = aura;
      c.lineWidth = 1.4;
      c.beginPath();
      c.ellipse(0, 0, 24 + f * 42, 17 + f * 24, 0, 0, TAU);
      c.stroke();
    }
    if (!reduced) {
      for (let i = 0; i < 14; i++) {
        const a = i * 2.39996 + t * 0.2,
          r = 12 + ((((i * 0.17 - t * 0.8) % 1) + 1) % 1) * 56;
        c.globalAlpha = 0.5;
        line(
          c,
          [
            [Math.cos(a) * r, Math.sin(a) * r],
            [Math.cos(a) * (r + 6), Math.sin(a) * (r + 6)],
          ],
          aura,
          1,
        );
      }
      if (power > 0.7)
        for (let i = 0; i < 3; i++) {
          const a = t * 2 + (i * TAU) / 3,
            pts = Array.from({ length: 5 }, (_, j) => {
              const b = a + Math.sin(j * 4 + t * 27) * 0.13;
              return [Math.cos(b) * (30 + j * 5), Math.sin(b) * (30 + j * 5)];
            });
          line(c, pts, "#e9faff", 1);
        }
    }
    c.restore();
  }
  function personalDesign(base,e){
    if(!e.appearance||typeof UZAvatar==='undefined')return base;const a=UZAvatar.clean(e.appearance),p=UZAvatar.palettes;
    const flags=base.flags.filter(f=>!['slim','wide','large','small'].includes(f));if(a.body==='slim')flags.push('slim');if(a.body==='broad')flags.push('wide');
    return {...base,flags,skin:p.skin[a.skin],hair:base.hair?p.hair[a.hair]:base.hair,cut:a.cut,cloth:p.cloth[a.cloth],trim:p.trim[a.trim]};
  }
  Art.personalDesign=personalDesign;
  function fighter(c, e, t, scale = 1) {
    const meta = UZ.CHARACTERS.find((ch) => ch.id === e.skin),
      d = personalDesign(UZDesigns[e.skin] || UZDesigns[meta?.skin] || UZDesigns.soldier,e);
    const f = new Set(d.flags),
      form = e.form || meta?.form,
      hair = form && d.hair ? (forms[form] || forms.gold)[0] : d.hair;
    const run = e.state === "run",
      fly = ["fly", "glide", "dash"].includes(e.state),
      attack = e.state === "attack",
      guard = e.state === "guard",
      charge = ["charge", "chargeAim"].includes(e.state),
      blast = e.state === "blast";
    const reduced = Art.reduceMotion === true,
      clock = reduced ? 0 : t,
      phase = Math.sin(clock * 19),
      breath = Math.sin(clock * 3) * 0.45;
    const broad = f.has("wide")
        ? 1.35
        : f.has("large")
          ? 1.2
          : f.has("slim")
            ? 0.86
            : 1,
      small = f.has("small") ? 0.83 : f.has("giant") ? 1.5 : 1;
    const power = Math.max(0, Math.min(1, e.chargeRatio || 0));
    c.save();
    c.translate(e.x || 0, e.y || 0);
    c.scale(scale * 0.69 * small, scale * 0.69 * small);
    c.lineJoin = "round";
    c.lineCap = "round";
    oval(c, 2, 6, 25 * broad, 13, "#03111c50", null);
    if (charge || form)
      energy(
        c,
        { ...e, form },
        clock,
        charge ? (e.state === "charge" ? 0.75 : power) : 0.55,
        reduced,
      );
    c.rotate(
      (e.angle || 0) + (e.state === "stun" ? Math.sin(clock * 42) * 0.06 : 0),
    );
    if (d.rig === "serpent") {
      const points = Array.from({ length: 25 }, (_, i) => [
        16 - i * 4,
        Math.sin(i * 0.43 - clock * 2) * (8 + i * 0.5),
      ]);
      tube(c, points, d.skin, 16);
      line(
        c,
        points.map(([x, y]) => [x, y + 4]),
        d.trim,
        5,
      );
      for (let i = 2; i < 22; i += 2) {
        const [x, y] = points[i];
        path(
          c,
          [
            [x, y - 7],
            [x - 5, y - 17],
            [x + 3, y - 8],
          ],
          d.trim,
        );
      }
      oval(c, 17, 0, 18, 13, d.skin);
      path(
        c,
        [
          [26, -9],
          [42, -5],
          [43, 5],
          [26, 9],
        ],
        d.trim,
      );
      for (const side of [-1, 1]) {
        tube(
          c,
          [
            [10, side * 8],
            [2, side * 22],
            [-6, side * 27],
          ],
          d.trim,
          3,
        );
        line(
          c,
          [
            [33, side * 5],
            [44, side * 13],
            [56, side * 12],
          ],
          d.trim,
          1.5,
        );
        oval(c, 25, side * 7, 4, 2, "#f7d564");
      }
      c.restore();
      return;
    }
    if (f.has("tail")) {
      const a = fly ? 4 : Math.sin(clock * 3) * 7;
      c.strokeStyle = outline;
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(-10, 0);
      c.bezierCurveTo(-40, -14, -46, 19 + a, -30, 24 + a);
      c.stroke();
      c.strokeStyle = d.rig === "armor" ? "#947045" : d.skin;
      c.lineWidth = 4.5;
      c.stroke();
    }
    if (f.has("cape") || d.rig === "coat" || d.rig === "angel") {
      const color = f.has("namek")
        ? "#f0ead7"
        : d.rig === "angel"
          ? d.cloth
          : f.has("antenna")
            ? "#9854a2"
            : d.trim;
      path(
        c,
        [
          [4, -14],
          [-26, -24 - breath],
          [-39, -14 + phase * 2],
          [-33, 0],
          [-39, 18 + phase * 2],
          [-25, 25 + breath],
          [4, 14],
        ],
        color,
      );
      for (let i = -1; i <= 1; i++)
        line(
          c,
          [
            [0, i * 8],
            [-30, i * 15],
          ],
          "#18273a44",
          1.5,
        );
    }
    if (f.has("wings") || f.has("carapace"))
      for (const side of [-1, 1])
        path(
          c,
          [
            [-1, side * 10],
            [-30, side * 27],
            [-34, side * 10],
            [-9, side * 3],
          ],
          f.has("wings") ? d.skin : "#223442",
        );
    if (f.has("sword")) {
      tube(
        c,
        [
          [-26, 19],
          [11, -22],
        ],
        "#c6d7df",
        4,
      );
      tube(
        c,
        [
          [10, -22],
          [18, -31],
        ],
        "#77593f",
        4,
      );
      line(
        c,
        [
          [5, -23],
          [16, -13],
        ],
        "#d3b66e",
        3,
      );
    }
    if (f.has("staff")) {
      tube(
        c,
        [
          [-35, 27],
          [42, 27],
        ],
        "#9b794a",
        3,
      );
      if (d.rig === "angel") {
        oval(c, 40, 27, 7, 7, "#202638", "#6fd4e3", 2);
      }
    }
    c.scale(1, broad);
    // From overhead the pelvis covers the thighs: walking stays compact while flight streams behind.
    for (const side of [-1, 1]) {
      const gait = Math.sin(clock * 15 + (side === 1 ? Math.PI : 0)),
        landing = (Math.cos(clock * 15 + (side === 1 ? Math.PI : 0)) + 1) / 2,
        kick = attack && e.combo === 3 && side === 1;
      let hip = [-8, side * 5],
        knee = [-11, side * 6],
        foot = [-17, side * 7];
      if (run) {
        hip = [-7, side * 4.5];
        knee = [-9 - gait * 2, side * (5 + Math.max(0, gait) * 1.2)];
        foot = [
          -15 - Math.max(0, gait) * 3.5,
          side * (6 + Math.max(0, gait) * 1.8),
        ];
      } else if (fly) {
        const tuck = Math.sin(clock * 8 + side * Math.PI) * 2;
        hip = [-8, side * 5];
        knee = [-14 - tuck, side * 8];
        foot = [
          -20 - tuck,
          side * (8 + Math.cos(clock * 8 + side * Math.PI) * 2),
        ];
      } else if (guard) {
        knee = [-6, side * 10];
        foot = [-14, side * 15];
      } else if (charge) {
        knee = [-8, side * 8];
        foot = [-15, side * 12];
      } else if (attack) {
        knee = [-8, side * 7];
        foot = [-14, side * 9];
      } else if (e.state === "stun") {
        knee = [-3, side * 11];
        foot = [-11, side * 15];
      }
      if (kick) {
        hip = [-2, 6];
        knee = [7, 11];
        foot = [20, 11];
      }
      if (e.state === "dash" && side === 1) {
        knee = [-17, 8];
        foot = [-29, 10];
      }
      tube(c, [hip, knee, foot], d.cloth, run ? 8 : fly ? 7.5 : 8.5);
      tube(
        c,
        [foot, [foot[0] - (fly ? 5 : run ? 2.2 : 3), foot[1]]],
        d.rig === "armor" || d.rig === "suit" ? "#e6e8df" : d.trim,
        run ? 5.5 : 6.5,
      );
      if (run) {
        oval(
          c,
          foot[0] - 3,
          foot[1] + 3,
          4 + landing,
          1.8,
          "#061018" + Math.round(18 + landing * 23).toString(16),
          null,
        );
        line(
          c,
          [
            [foot[0] - 1, foot[1] - 2],
            [foot[0] - 1, foot[1] + 2],
          ],
          "#fff4cc77",
          0.8,
        );
      }
    }
    const bare = ["bare", "alien", "majin", "animal", "dragon"].includes(d.rig),
      body = bare ? d.skin : d.cloth;
    path(
      c,
      [
        [-16, -9],
        [-3, -14 - breath],
        [8, -10],
        [10, 10],
        [-3, 14 + breath],
        [-16, 9],
      ],
      body,
    );
    path(
      c,
      [
        [-15, 1],
        [7, 3],
        [6, 10],
        [-13, 9],
      ],
      "#16233833",
      null,
    );
    if (d.rig === "gi" || d.rig === "robe" || d.rig === "kai") {
      path(
        c,
        [
          [6, -10],
          [-5, 0],
          [5, 10],
          [-2, 12],
          [-13, 0],
          [-1, -13],
        ],
        d.trim,
        null,
      );
      line(
        c,
        [
          [-4, -9],
          [-12, -3],
        ],
        "#fff9df44",
        1.2,
      );
    }
    if (d.rig === "vest") {
      for (const side of [-1, 1])
        tube(
          c,
          [
            [-12, side * 10],
            [5, side * 12],
          ],
          d.trim,
          7,
        );
    }
    if (d.rig === "armor") {
      path(
        c,
        [
          [-14, -12],
          [5, -13],
          [9, -7],
          [9, 7],
          [5, 13],
          [-14, 12],
        ],
        "#e9e9dd",
      );
      path(
        c,
        [
          [-13, -8],
          [2, -8],
          [2, 8],
          [-13, 8],
        ],
        d.trim,
      );
      for (let i = -10; i < 2; i += 3)
        line(
          c,
          [
            [i, -7],
            [i, 7],
          ],
          "#5d594650",
          0.8,
        );
      for (const side of [-1, 1])
        path(
          c,
          [
            [-8, side * 11],
            [-13, side * 20],
            [2, side * 21],
            [8, side * 11],
          ],
          d.trim,
        );
    }
    if (d.rig === "jacket") {
      line(
        c,
        [
          [-13, 0],
          [8, 0],
        ],
        d.trim,
        2,
      );
      for (const side of [-1, 1]) {
        path(
          c,
          [
            [5, side * 2],
            [-3, side * 8],
            [7, side * 12],
          ],
          d.cloth,
        );
        line(
          c,
          [
            [-7, side * 5],
            [-3, side * 5],
          ],
          "#eef5ebaa",
          1,
        );
      }
    }
    if (d.rig === "robot") {
      for (const side of [-1, 1]) oval(c, -4, side * 13, 7, 7, d.trim);
      path(
        c,
        [
          [-12, -8],
          [5, -9],
          [7, 8],
          [-13, 8],
        ],
        "#aebdc0",
      );
      for (let i = -8; i < 6; i += 4)
        line(
          c,
          [
            [i, -6],
            [i, 6],
          ],
          "#344c59",
          1.4,
        );
    }
    if (d.rig === "god" || d.rig === "angel") {
      path(
        c,
        [
          [3, -13],
          [-12, -10],
          [-16, 0],
          [-12, 10],
          [3, 13],
        ],
        "#223c69",
      );
      path(
        c,
        [
          [-3, -7],
          [3, 0],
          [-3, 7],
          [-9, 0],
        ],
        d.trim,
      );
    }
    if (f.has("shell")) {
      oval(c, -9, 0, 18, 16, "#926b45");
      for (const side of [-1, 1])
        line(
          c,
          [
            [-21, side * 7],
            [-10, side * 12],
            [2, side * 7],
          ],
          "#c2a56a",
          1,
        );
      line(
        c,
        [
          [-25, 0],
          [8, 0],
        ],
        "#604c3c",
        1.5,
      );
    }
    line(
      c,
      [
        [-13, -10],
        [-13, 10],
      ],
      d.trim,
      4,
    );
    if (f.has("pelt")) {
      path(
        c,
        [
          [-13, -13],
          [-23, -18],
          [-25, -6],
          [-30, 0],
          [-24, 12],
          [-17, 18],
          [-12, 10],
        ],
        d.trim,
      );
    }
    // Two articulated shoulders and forearms, with distinct left/right combo poses.
    for (const side of [-1, 1]) {
      if (f.has("onearm") && side === 1) continue;
      const striking = attack && (e.combo % 2 === 0 ? side === 1 : side === -1),
        wind = attack ? Math.sin(clock * 24) * 2 : 0;
      const armSwing = Math.sin(clock * 15 + (side === 1 ? 0 : Math.PI));
      const shoulder = [0, side * 13],
        elbow = guard
          ? [14, side * 13]
          : charge
            ? [2, side * 21]
            : blast
              ? [20, side * 10]
              : striking
                ? [20, side * 9]
                : run
                  ? [-2, side * 18]
                  : fly
                    ? e.boosting
                      ? [-14, side * 14]
                      : e.state === "glide"
                        ? [-5, side * 23]
                        : [-9, side * 18]
                    : [5, side * (19 + breath)];
      const hand = guard
        ? [21, side * 6]
        : charge
          ? e.state === "chargeAim"
            ? [12, side * 9]
            : [9, side * 23]
          : blast
            ? [33, side * 4]
            : striking
              ? [33 + wind, side * 3]
              : run
                ? [-3 + armSwing * 6, side * 22]
                : fly
                  ? e.boosting
                    ? [-27, side * 14]
                    : e.state === "glide"
                      ? [-12, side * 26]
                      : [-17, side * 18]
                  : [9, side * 13];
      tube(c, [shoulder, elbow, hand], d.skin, 6.7);
      if (!bare)
        tube(
          c,
          [
            shoulder,
            [(shoulder[0] + elbow[0]) * 0.5, (shoulder[1] + elbow[1]) * 0.5],
          ],
          d.cloth,
          8,
        );
      if (f.has("namek")) {
        tube(
          c,
          [elbow, [(elbow[0] + hand[0]) * 0.5, (elbow[1] + hand[1]) * 0.5]],
          "#c88791",
          4,
        );
        for (let j = 0; j < 3; j++)
          line(
            c,
            [
              [elbow[0] + j * 2, elbow[1] - 2],
              [elbow[0] + j * 2, elbow[1] + 2],
            ],
            "#744759",
            0.8,
          );
      }
      oval(
        c,
        hand[0],
        hand[1],
        4.5,
        4,
        d.rig === "armor" || d.rig === "suit" ? "#edf0e8" : d.skin,
      );
      line(
        c,
        [
          [hand[0] - 4, hand[1] - 3],
          [hand[0] - 4, hand[1] + 3],
        ],
        d.trim,
        3,
      );
      line(
        c,
        [
          [hand[0] + 1, hand[1] - 2],
          [hand[0] + 1, hand[1] + 2],
        ],
        "#78544866",
        0.7,
      );
    }
    if (f.has("scarf"))
      path(
        c,
        [
          [3, -13],
          [10, -10],
          [9, 10],
          [0, 13],
          [-5, 4],
          [-24, 17 + phase * 2],
          [-12, 2],
        ],
        d.trim,
      );
    // Head sits ahead of shoulders, maintaining an overhead silhouette, never a front-facing doll.
    c.save();
    c.translate(14 + breath, 0);
    c.scale(0.82, 0.82);
    oval(c, 0, 0, 11.5, 10.5, d.skin);
    path(
      c,
      [
        [4, -9],
        [12, -5],
        [14, 0],
        [12, 5],
        [4, 9],
        [7, 0],
      ],
      "#92634e25",
      null,
    );
    for (const side of [-1, 1]) {
      if (f.has("pointed") || f.has("namek"))
        path(
          c,
          [
            [-2, side * 7],
            [-9, side * 18],
            [5, side * 10],
          ],
          d.skin,
        );
      else oval(c, -1, side * 10, 3, 3.2, d.skin);
      if (f.has("ears")) {
        path(
          c,
          [
            [-4, side * 7],
            [-16, side * 25],
            [4, side * 14],
          ],
          d.skin,
        );
        path(
          c,
          [
            [-4, side * 10],
            [-12, side * 21],
            [0, side * 14],
          ],
          d.trim,
          null,
        );
      }
      if (f.has("horns")) {
        tube(
          c,
          [
            [-4, side * 9],
            [-13, side * 17],
            [-15, side * 25],
          ],
          "#e4d6ba",
          3.4,
        );
      }
      if (f.has("namek"))
        tube(
          c,
          [
            [6, side * 5],
            [14, side * 12],
            [18, side * 11],
          ],
          d.skin,
          1.5,
        );
    }
    if (f.has("antenna")) {
      tube(
        c,
        [
          [-3, 0],
          [-15, -1],
          [-24, -9 + breath],
          [-19, -15],
        ],
        d.skin,
        4.5,
      );
    }
    if (hair) {
      if (["pony", "braid"].includes(d.cut)) {
        tube(
          c,
          [
            [-10, 0],
            [-26, 4],
            [-39, Math.sin(clock * 4) * 4],
          ],
          hair,
          d.cut === "braid" ? 5 : 9,
        );
      }
      if (d.cut === "bun") oval(c, -15, 0, 7, 8, hair);
      oval(c, 13, 0, 10, 10, hair, outline, 1.4);
      path(c, overheadHair[d.cut] || overheadHair.spike, hair);
      const highlights =
        d.cut === "part" || d.cut === "bob"
          ? [
              [
                [7, -7],
                [14, -8],
                [19, -6],
              ],
              [
                [8, 6],
                [14, 7],
                [19, 5],
              ],
            ]
          : [
              [
                [7, -7],
                [12, -5],
                [17, -8],
              ],
              [
                [8, 5],
                [13, 6],
                [17, 3],
              ],
            ];
      for (const p of highlights)
        line(c, p, form ? "#ffffff8a" : "#728aa455", 1.1);
    }
    if (d.rig === "cell") {
      path(
        c,
        [
          [-12, -12],
          [5, -21],
          [8, -18],
          [1, -5],
          [-1, 0],
          [1, 5],
          [8, 18],
          [5, 21],
          [-12, 12],
        ],
        d.cloth,
      );
      path(
        c,
        [
          [-12, -6],
          [-4, -5],
          [-4, 5],
          [-12, 6],
        ],
        "#263747",
      );
    }
    if (f.has("gem")) oval(c, -3, 0, 7, 8, d.trim);
    if (f.has("brain")) {
      oval(c, -2, 0, 9, 9, "#cfa0ad", "#b9e2e5", 2);
      for (let i = -5; i < 6; i += 3)
        line(
          c,
          [
            [-7, i],
            [-2, i + 2],
            [4, i],
          ],
          "#946879",
          1,
        );
    }
    if (f.has("spines"))
      for (let i = 0; i < 5; i++) {
        const a = 1.7 + i * 0.7;
        path(
          c,
          [
            [Math.cos(a) * 9, Math.sin(a) * 9],
            [Math.cos(a) * 18, Math.sin(a) * 18],
            [Math.cos(a + 0.3) * 10, Math.sin(a + 0.3) * 10],
          ],
          d.trim,
        );
      }
    if (f.has("turban")) {
      oval(c, -3, 0, 12, 12, "#f2ead8");
      for (let i = -6; i < 8; i += 4)
        line(
          c,
          [
            [-10, i],
            [5, i + 2],
          ],
          "#bbc4b6",
          1,
        );
    }
    if (f.has("cap")) {
      oval(c, -3, 0, 11, 12, d.cloth);
      path(
        c,
        [
          [3, -12],
          [13, -8],
          [13, 8],
          [3, 12],
        ],
        d.trim,
      );
    }
    if (f.has("band"))
      line(
        c,
        [
          [-1, -11],
          [5, -8],
          [5, 8],
          [-1, 11],
        ],
        d.trim,
        3,
      );
    if (f.has("dots"))
      for (let i = 0; i < 6; i++)
        oval(
          c,
          -3 + (i % 2) * 3,
          -4 + Math.floor(i / 2) * 4,
          0.8,
          0.8,
          "#a16d4c",
          null,
        );
    const eyeColor = f.has("alienEyes") ? "#19212d" : "#f1eee0";
    for (const side of [-1, 1]) {
      path(
        c,
        [
          [7, side * 7],
          [13, side * 5],
          [12, side * 2],
          [8, side * 3],
        ],
        eyeColor,
        outline,
        0.9,
      );
      if (!f.has("alienEyes"))
        line(
          c,
          [
            [11, side * 4],
            [12, side * 4],
          ],
          form ? "#3b9ba6" : "#203047",
          1.5,
        );
      line(
        c,
        [
          [6, side * 8],
          [12, side * 6],
        ],
        hair || outline,
        1.2,
      );
    }
    line(
      c,
      [
        [14, -2],
        [15, 0],
        [14, 2],
      ],
      "#936f6366",
      0.8,
    );
    if (f.has("thirdEye")) oval(c, 1, 0, 3, 1.6, "#f2f1e3");
    if (f.has("fourEyes"))
      for (const side of [-1, 1]) oval(c, 1, side * 7, 2.6, 2, "#f2efda");
    if (f.has("glasses")) {
      for (const side of [-1, 1])
        oval(c, 10, side * 5, 3.8, 4, "#1b3143", "#c4d6d3", 0.8);
      line(
        c,
        [
          [10, -3],
          [10, 3],
        ],
        "#c4d6d3",
        1,
      );
    }
    if (f.has("scouter") || f.has("eyepatch")) {
      path(
        c,
        [
          [7, -10],
          [14, -9],
          [15, -2],
          [8, -2],
        ],
        f.has("scouter") ? "#6fefa6b0" : "#202d3d",
        "#d5e9d8",
        0.7,
      );
      line(
        c,
        [
          [5, -11],
          [9, -11],
        ],
        "#d1dae0",
        2.4,
      );
    }
    if (f.has("scar"))
      line(
        c,
        [
          [10, 5],
          [13, 8],
        ],
        "#a06254",
        1,
      );
    if (f.has("beard"))
      path(
        c,
        [
          [11, -8],
          [21, -5],
          [28, 0],
          [21, 5],
          [11, 8],
          [16, 0],
        ],
        "#e9e5d6",
      );
    if (f.has("moustache")) {
      for (const side of [-1, 1])
        path(
          c,
          [
            [13, 0],
            [19, side * 5],
            [14, side * 9],
            [12, side * 4],
          ],
          d.hair || "#e5dfd0",
        );
    }
    if (f.has("snout")) oval(c, 14, 0, 4, 5, d.trim);
    if (f.has("mask"))
      path(
        c,
        [
          [10, -8],
          [18, -5],
          [20, 0],
          [18, 5],
          [10, 8],
        ],
        "#dbe1e7",
      );
    if (f.has("earrings"))
      for (const side of [-1, 1]) oval(c, 0, side * 13, 1.6, 1.6, "#f3d76f");
    c.restore();
    if (f.has("spots"))
      for (let i = 0; i < 12; i++)
        oval(
          c,
          -15 + (i % 4) * 5,
          -10 + Math.floor(i / 4) * 8,
          1,
          1.4,
          "#233b32",
          null,
        );
    if (f.has("rivets"))
      for (const side of [-1, 1])
        for (let x = -12; x < 8; x += 7)
          oval(c, x, side * 10, 1.2, 1.2, "#d3dddd", null);
    if (d.rig === "majin" || f.has("majin")) {
      c.fillStyle = "#28273b";
      c.font = "bold 5px serif";
      c.textAlign = "center";
      c.fillText("M", -13, 2);
    }
    if (f.has("halo")) {
      c.strokeStyle = "#7bd9ed";
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(1, 0, 18, 24, 0, 0, TAU);
      c.stroke();
    }
    if (f.has("emblem") || f.has("rr")) {
      oval(c, -6, -7, 3.6, 3.6, "#f3edd9");
      c.fillStyle = "#213147";
      c.font = "bold 4px sans-serif";
      c.textAlign = "center";
      c.fillText(f.has("rr") ? "RR" : "亀", -6, -5.5);
    }
    if (guard) {
      c.save();
      c.globalCompositeOperation = "lighter";
      c.strokeStyle = "#a6f1ff";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, 35, -1.2, 1.2);
      c.stroke();
      c.restore();
    }
    if (charge || blast) {
      const x = charge ? 16 : 35,
        r = charge ? 4 + power * 5 : 8;
      c.save();
      c.globalCompositeOperation = "lighter";
      c.shadowColor = e.equipped === "galick" ? "#cf7cf5" : "#5adaff";
      c.shadowBlur = 15;
      oval(c, x, 0, r, r, "#e0fbff", null);
      c.strokeStyle = "#92ecff";
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(x, 0, r + 4, clock * 5, clock * 5 + 4.5);
      c.stroke();
      c.restore();
    }
    c.restore();
  }
  // Illustrated dialogue portraits use the same model sheet as the overhead rig.
  function portrait(c, e, t = 0, scale = 1) {
    const d = personalDesign(UZDesigns[e.skin] || UZDesigns.goku,e),
      f = new Set(d.flags),
      broad = f.has("wide") ? 1.25 : f.has("slim") ? 0.88 : 1;
    const hair = e.form && d.hair ? (forms[e.form] || forms.gold)[0] : d.hair,
      bob = Math.sin(t * 2) * 0.3;
    c.save();
    c.translate(e.x || 0, (e.y || 0) + bob);
    c.scale(scale * broad, scale);
    if (d.rig === "serpent") {
      fighter(c, { ...e, x: 0, y: -35, angle: -Math.PI / 2 }, t, 1.7);
      c.restore();
      return;
    }
    if (f.has("cape")) {
      path(
        c,
        [
          [-14, -38],
          [-28, -25],
          [-29, 0],
          [0, -5],
          [29, 0],
          [28, -25],
          [14, -38],
        ],
        f.has("namek") ? "#eee8d8" : d.trim,
      );
      line(
        c,
        [
          [-13, -30],
          [-20, -3],
        ],
        "#1b324a44",
        1.5,
      );
      line(
        c,
        [
          [13, -30],
          [20, -3],
        ],
        "#1b324a44",
        1.5,
      );
    }
    for (const side of [-1, 1]) {
      tube(
        c,
        [
          [side * 8, -14],
          [side * 10, -5],
          [side * 10, 3],
        ],
        d.cloth,
        10,
      );
      tube(
        c,
        [
          [side * 10, 0],
          [side * 14, 3],
        ],
        d.trim,
        7,
      );
    }
    const bare = ["bare", "alien", "majin", "dragon"].includes(d.rig);
    path(
      c,
      [
        [-13, -37],
        [-19, -29],
        [-13, -13],
        [13, -13],
        [19, -29],
        [13, -37],
      ],
      bare ? d.skin : d.cloth,
    );
    path(
      c,
      [
        [1, -36],
        [15, -30],
        [10, -15],
        [0, -15],
      ],
      "#20304725",
      null,
    );
    if (d.rig === "gi" || d.rig === "robe")
      path(
        c,
        [
          [-10, -37],
          [0, -27],
          [10, -37],
          [14, -32],
          [0, -20],
          [-14, -32],
        ],
        d.trim,
      );
    if (d.rig === "armor") {
      path(
        c,
        [
          [-15, -34],
          [15, -34],
          [12, -16],
          [-12, -16],
        ],
        "#e8e7da",
      );
      path(
        c,
        [
          [-10, -26],
          [10, -26],
          [10, -17],
          [-10, -17],
        ],
        d.trim,
      );
      for (let y = -24; y < -17; y += 2.5)
        line(
          c,
          [
            [-9, y],
            [9, y],
          ],
          "#75685577",
          0.7,
        );
      for (const side of [-1, 1]) oval(c, side * 19, -33, 9, 4, d.trim);
    }
    if (d.rig === "jacket")
      for (const side of [-1, 1])
        path(
          c,
          [
            [side * 2, -36],
            [side * 13, -35],
            [side * 16, -18],
            [side * 3, -18],
          ],
          d.cloth,
        );
    if (d.rig === "vest")
      for (const side of [-1, 1])
        tube(
          c,
          [
            [side * 10, -36],
            [side * 14, -22],
          ],
          d.trim,
          6,
        );
    for (const side of [-1, 1]) {
      if (f.has("onearm") && side === -1) continue;
      tube(
        c,
        [
          [side * 16, -32],
          [side * 23, -22],
          [side * 19, -12],
        ],
        d.skin,
        7,
      );
      if (!bare)
        tube(
          c,
          [
            [side * 16, -32],
            [side * 20, -27],
          ],
          d.cloth,
          9,
        );
      oval(c, side * 19, -11, 4, 4, d.rig === "armor" ? "#f0eee2" : d.skin);
      line(
        c,
        [
          [side * 16, -15],
          [side * 22, -15],
        ],
        d.trim,
        3,
      );
    }
    line(
      c,
      [
        [-12, -14],
        [12, -14],
      ],
      d.trim,
      4,
    );
    for (const side of [-1, 1])
      line(
        c,
        [
          [side * 4, -17],
          [side * 8, -21],
        ],
        "#ffffff44",
        0.8,
      );
    if (f.has("emblem")) {
      oval(c, 9, -27, 4, 4, "#eee9d8");
      c.fillStyle = outline;
      c.font = "5px serif";
      c.textAlign = "center";
      c.fillText("亀", 9, -25);
    }
    tube(
      c,
      [
        [0, -33],
        [0, -42],
      ],
      d.skin,
      8,
    );
    c.save();
    c.translate(0, -49);
    for (const side of [-1, 1]) oval(c, side * 12, 0, 3, 4, d.skin);
    path(
      c,
      [
        [-10, -11],
        [10, -11],
        [12, 1],
        [8, 9],
        [0, 13],
        [-8, 9],
        [-12, 1],
      ],
      d.skin,
    );
    path(
      c,
      [
        [5, -9],
        [11, -7],
        [11, 2],
        [6, 9],
        [0, 12],
        [3, 2],
      ],
      "#72526b25",
      null,
    );
    if (f.has("pointed") || f.has("namek"))
      for (const side of [-1, 1])
        path(
          c,
          [
            [side * 10, -2],
            [side * 21, -7],
            [side * 14, 5],
            [side * 10, 4],
          ],
          d.skin,
        );
    if (hair) {
      const points = (cuts[d.cut] || cuts.spike).map(([x, y]) => [
        y * 0.85,
        x * 0.9 + 1,
      ]);
      path(c, points, hair);
      for (const side of [-1, 1])
        line(
          c,
          [
            [side * 4, -12],
            [side * 9, -7],
            [side * 7, -3],
          ],
          e.form ? "#ffffff88" : "#778eaa55",
          0.8,
        );
    }
    if (f.has("turban")) {
      oval(c, 0, -10, 13, 7, "#ede7d5");
      for (let y = -13; y < -6; y += 2.5)
        line(
          c,
          [
            [-10, y],
            [11, y + 1],
          ],
          "#b4c0ad",
          0.8,
        );
    }
    if (f.has("cap")) {
      path(
        c,
        [
          [-12, -5],
          [-10, -16],
          [9, -16],
          [13, -5],
        ],
        d.cloth,
      );
      line(
        c,
        [
          [-13, -5],
          [15, -5],
        ],
        d.trim,
        3,
      );
    }
    if (f.has("ears") || f.has("horns"))
      for (const side of [-1, 1])
        path(
          c,
          [
            [side * 7, -8],
            [side * 13, -27],
            [side * 16, -7],
          ],
          f.has("horns") ? "#e1d7bd" : d.skin,
        );
    if (f.has("antenna"))
      tube(
        c,
        [
          [0, -12],
          [1, -22],
          [7, -26],
        ],
        d.skin,
        3,
      );
    if (f.has("gem")) oval(c, 0, -8, 8, 6, d.trim);
    for (const side of [-1, 1]) {
      path(
        c,
        [
          [side * 2, 0],
          [side * 10, -2],
          [side * 8, 3],
          [side * 3, 3],
        ],
        "#f4efdf",
        outline,
        0.6,
      );
      line(
        c,
        [
          [side * 5, 0],
          [side * 5, 2],
        ],
        e.form ? "#3f989e" : outline,
        1.4,
      );
      line(
        c,
        [
          [side * 2, -2],
          [side * 9, -4],
        ],
        hair || outline,
        1.3,
      );
    }
    line(
      c,
      [
        [0, 1],
        [-1, 5],
        [1, 5],
      ],
      "#aa765b",
      0.6,
    );
    line(
      c,
      [
        [-3, 8],
        [3, 8],
      ],
      "#804e45",
      0.7,
    );
    if (f.has("glasses")) {
      for (const side of [-1, 1])
        oval(c, side * 6, 0, 5, 3.5, "#193447", "#aabec6", 0.8);
      line(
        c,
        [
          [-2, 0],
          [2, 0],
        ],
        "#afbfbd",
        1,
      );
    }
    if (f.has("beard"))
      path(
        c,
        [
          [-10, 3],
          [-11, 10],
          [0, 22],
          [11, 10],
          [10, 3],
          [3, 7],
          [-3, 7],
        ],
        "#e8e6d8",
      );
    if (f.has("moustache"))
      for (const side of [-1, 1])
        path(
          c,
          [
            [0, 6],
            [side * 11, 5],
            [side * 9, 10],
            [side * 2, 9],
          ],
          hair || "#e8e0cc",
        );
    if (f.has("thirdEye")) oval(c, 0, -6, 2.5, 1.5, "#f5eee2");
    if (f.has("scouter")) {
      path(
        c,
        [
          [-11, -4],
          [-1, -4],
          [-1, 3],
          [-11, 3],
        ],
        "#5fedb077",
        "#d6e9d8",
        0.7,
      );
    }
    if (f.has("earrings"))
      for (const side of [-1, 1]) oval(c, side * 12, 6, 1.6, 1.6, "#efce72");
    if (f.has("scar"))
      line(
        c,
        [
          [7, 2],
          [9, 6],
        ],
        "#a56e57",
        0.8,
      );
    c.restore();
    c.restore();
  }
  Art.character = portrait;
  Art.fighter = fighter;
  Art.modelManifest = UZDesigns;
})();
