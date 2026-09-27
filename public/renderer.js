/* Original vector art, drawn at any resolution. No sprite sheets or external images. */
window.Art = (() => {
  const palette = {
    goku: ["#ed8843", "#263d64", "#f4c093", "#182a2c"],
    vegeta: ["#39577d", "#f0dfb3", "#eec299", "#18272d"],
    raditz: ["#665144", "#ccb578", "#e9b587", "#20292b"],
    krillin: ["#ea8d48", "#2b456b", "#edb888", null],
    piccolo: ["#786491", "#e3e5d3", "#91b66d", null],
    buu: ["#eee6d3", "#72618a", "#e5a3bb", null],
    kidbuu: ["#eee4d2", "#493b68", "#dfa1b8", null],
    frieza: ["#e4e5df", "#865e9d", "#dddde0", null],
    golden: ["#d4ae57", "#7c5097", "#e2c677", null],
    cell: ["#85a15a", "#293c3a", "#bdd094", "#26362c"],
    soldier: ["#465866", "#e7e3c8", "#d4bc9b", "#354439"],
    android: ["#45516e", "#ddb46c", "#f3cdac", "#d9bc75"],
    roshi: ["#e1a268", "#ede9d6", "#e5bb95", null],
    trunks: ["#6a81a0", "#3a4653", "#e6bc9c", "#b9a2c3"],
    kai: ["#3c5770", "#e7c783", "#82a0ae", null],
    glorio: ["#61587d", "#917b8f", "#889bbc", "#e5dfdc"],
    whis: ["#842f54", "#67b5b5", "#a6c3df", "#e5e5dc"],
    beerus: ["#626596", "#dbb364", "#9b80b7", null],
    jiren: ["#b9474c", "#252e33", "#b7bfc5", null],
    ginyu: ["#4d3d55", "#e4dfca", "#a88bbc", null],
    hit: ["#665775", "#453751", "#a898ba", null],
    black: ["#454250", "#a24868", "#efbfab", "#d287af"],
    broly: ["#759251", "#36503b", "#ddb281", "#28352b"],
    demon: ["#795180", "#c49b68", "#b8879a", null],
    pilaf: ["#456577", "#bd685d", "#96bdba", null],
    moro: ["#3b7c88", "#d0bc91", "#88a2a1", null],
    omega: ["#e1decb", "#7e94a1", "#c3c8b0", null],
  };
  function ellipse(c, x, y, rx, ry, color) {
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  }
  function poly(c, points, color) {
    c.fillStyle = color;
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fill();
  }
  function line(c, points, color, width = 2) {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
  }
  function character(c, e, t = 0, scale = 1) {
    const colors = palette[e.skin] || palette.goku;
    let [suit, accent, skin, hair] = colors;
    const moving = e.state === "run" || e.state === "dash",
      attack = e.state === "attack" || e.state === "blast",
      bob = moving ? Math.sin(t * 18) * 2 : Math.sin(t * 2) * 0.5;
    const step = moving ? Math.sin(t * 18) * 5 : 0;
    if (e.form && hair) hair = "#f7d879";
    c.save();
    c.translate(e.x || 0, e.y || 0);
    c.scale(scale, scale);
    ellipse(c, 3, 4, 19, 7, "#193d2a30");
    if (e.form || e.state === "charge") {
      c.globalAlpha = 0.25 + Math.sin(t * 9) * 0.08;
      ellipse(c, 0, -18, 27, 42, e.form ? "#f5e2a2" : "#b6eff0");
      c.globalAlpha = 1;
      line(
        c,
        [
          [-22, 4],
          [-25, -15],
          [-18, -42],
          [-11, -30],
          [0, -62],
          [11, -35],
          [21, -42],
          [27, -16],
          [23, 4],
        ],
        e.form ? "#ffedb6" : "#c3f9ff",
        1.5,
      );
    }
    c.translate(0, bob);
    if (e.angle > Math.PI / 2 || e.angle < -Math.PI / 2) c.scale(-1, 1);
    if (["frieza", "golden"].includes(e.skin))
      line(
        c,
        [
          [-10, -12],
          [-24, -3],
          [-37, -9],
          [-33, -28],
        ],
        skin,
        7,
      );
    if (["piccolo", "whis"].includes(e.skin))
      poly(
        c,
        [
          [-15, -33],
          [-24, -3],
          [0, -7],
          [25, 0],
          [15, -34],
        ],
        "#ebedda",
      );
    line(
      c,
      [
        [-7, -10],
        [-9, step - 1],
        [-13, step + 1],
      ],
      accent,
      9,
    );
    line(
      c,
      [
        [7, -10],
        [9, -step],
        [13, 2 - step],
      ],
      accent,
      9,
    );
    poly(
      c,
      [
        [-14, -31],
        [13, -31],
        [17, -10],
        [9, -6],
        [-12, -7],
        [-17, -17],
      ],
      suit,
    );
    poly(
      c,
      [
        [-12, -30],
        [0, -17],
        [12, -30],
        [4, -33],
        [-3, -32],
      ],
      accent,
    );
    line(
      c,
      [
        [-13, -10],
        [13, -10],
      ],
      accent,
      5,
    );
    const arm = attack ? 16 : e.state === "guard" ? -8 : 0;
    line(
      c,
      [
        [-13, -27],
        [-20, -17 + step * 0.3],
        [-16, -11],
      ],
      skin,
      8,
    );
    line(
      c,
      [
        [13, -26],
        [21 + arm, -20],
        [21 + arm, -14 - arm * 0.4],
      ],
      skin,
      8,
    );
    line(
      c,
      [
        [15, -26],
        [19, -22],
      ],
      suit,
      9,
    );
    ellipse(c, 22 + arm, -13 - arm * 0.4, 4.5, 4.5, skin);
    if (["vegeta", "raditz", "ginyu", "soldier"].includes(e.skin)) {
      poly(
        c,
        [
          [-12, -30],
          [12, -30],
          [12, -16],
          [-12, -16],
        ],
        "#e4dfc6",
      );
      poly(
        c,
        [
          [-9, -27],
          [9, -27],
          [8, -18],
          [-8, -18],
        ],
        "#bcaa78",
      );
    }
    ellipse(c, 0, -40, 12, 14, skin);
    ellipse(c, -11, -39, 3, 4, skin);
    ellipse(c, 11, -39, 3, 4, skin);
    poly(
      c,
      [
        [4, -37],
        [13, -36],
        [8, -33],
      ],
      skin,
    );
    if (hair) {
      if (e.skin === "trunks" || e.skin === "android")
        poly(
          c,
          [
            [-13, -38],
            [-15, -49],
            [-9, -55],
            [7, -55],
            [15, -48],
            [13, -36],
            [6, -47],
            [-3, -44],
            [-8, -34],
            [-8, -46],
          ],
          hair,
        );
      else
        poly(
          c,
          [
            [-12, -38],
            [-20, -49],
            [-11, -48],
            [-17, -59],
            [-5, -53],
            [-6, -68],
            [4, -58],
            [12, -64],
            [11, -54],
            [24, -56],
            [15, -45],
            [16, -36],
            [6, -43],
            [1, -48],
            [-5, -39],
          ],
          hair,
        );
    }
    if (e.skin === "piccolo") {
      line(
        c,
        [
          [-5, -51],
          [-8, -57],
          [-11, -55],
        ],
        skin,
        2,
      );
      line(
        c,
        [
          [5, -51],
          [8, -57],
          [11, -55],
        ],
        skin,
        2,
      );
      poly(
        c,
        [
          [-10, -42],
          [-22, -47],
          [-15, -36],
        ],
        skin,
      );
    }
    if (e.skin === "roshi") {
      ellipse(c, -6, -40, 7, 4, "#273a39");
      ellipse(c, 7, -40, 7, 4, "#273a39");
      line(
        c,
        [
          [-6, -40],
          [7, -40],
        ],
        "#dcc68c",
        1,
      );
      poly(
        c,
        [
          [-10, -32],
          [0, -17],
          [10, -32],
          [0, -29],
        ],
        "#f4ecd7",
      );
      line(
        c,
        [
          [25, -34],
          [27, 6],
        ],
        "#7c674a",
        3,
      );
    } else {
      line(
        c,
        [
          [-7, -40],
          [-1, -39],
        ],
        "#29362f",
        1.7,
      );
      line(
        c,
        [
          [5, -39],
          [10, -40],
        ],
        "#29362f",
        1.7,
      );
      line(
        c,
        [
          [1, -31],
          [6, -31],
        ],
        "#a46c55",
        1,
      );
    }
    if (["buu", "kidbuu"].includes(e.skin))
      line(
        c,
        [
          [0, -53],
          [4, -64],
          [13, -62],
          [15, -55],
        ],
        skin,
        6,
      );
    if (e.skin === "beerus") {
      poly(
        c,
        [
          [-10, -46],
          [-12, -72],
          [-2, -52],
        ],
        skin,
      );
      poly(
        c,
        [
          [4, -53],
          [14, -73],
          [13, -44],
        ],
        skin,
      );
    }
    if (e.skin === "frieza" || e.skin === "golden")
      ellipse(c, 0, -49, 8, 6, accent);
    if (e.skin === "cell") {
      poly(
        c,
        [
          [-12, -42],
          [-15, -67],
          [-2, -55],
          [2, -55],
          [16, -65],
          [12, -41],
        ],
        suit,
      );
      for (let i = 0; i < 4; i++)
        ellipse(c, -8 + i * 5, -52, 1.5, 2, "#263c2c");
    }
    if (e.skin === "krillin")
      for (let i = 0; i < 6; i++)
        ellipse(
          c,
          -4 + (i % 3) * 4,
          -48 + Math.floor(i / 3) * 4,
          0.8,
          0.8,
          "#8f6956",
        );
    if (e.skin === "whis") {
      poly(
        c,
        [
          [-9, -50],
          [-10, -76],
          [5, -83],
          [11, -73],
          [7, -51],
        ],
        hair,
      );
      c.strokeStyle = "#6db9cf";
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(0, -29, 22, 5, 0, 0, Math.PI * 2);
      c.stroke();
    }
    if (e.skin === "goku") {
      ellipse(c, 8, -22, 4, 4, "#f9e5bd");
      c.fillStyle = "#313c37";
      c.font = "5px sans-serif";
      c.fillText("亀", 5, -20);
    }
    if (e.state === "guard") {
      c.strokeStyle = "#c7eeec";
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(0, -23, 29, -1.2, 1.2);
      c.stroke();
    }
    c.restore();
  }
  return { character, ellipse, poly, line };
})();
