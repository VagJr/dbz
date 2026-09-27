window.Sound = {
  enabled: false,
  volume: 0.35,
  musicVolume: 0.12,
  music: null,
  region: null,
  active: new Set(),
  tracks: {
    earth: "earth",
    namek: "space",
    vegeta: "space",
    future: "future",
    otherworld: "kaioh",
    demon: "demon",
    vampa: "space",
    divine: "divine",
    arena: "divine",
  },
  effects: {
    hit: "impact/Audio/impactPunch_medium_000.ogg",
    slash: "sci-fi/Audio/laserSmall_000.ogg",
    cast: "sci-fi/Audio/laserLarge_000.ogg",
    dash: "sci-fi/Audio/forceField_000.ogg",
    parry: "sci-fi/Audio/forceField_001.ogg",
    transform: "sci-fi/Audio/forceField_003.ogg",
    break: "sci-fi/Audio/impactMetal_000.ogg",
  },
  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) this.setRegion(this.region || "earth", true);
    else {
      this.music?.pause();
      for (const a of this.active) a.pause();
      this.active.clear();
    }
    return this.enabled;
  },
  setRegion(region, force = false) {
    if (this.region === region && !force) return;
    this.region = region;
    if (!this.enabled) return;
    const src = `/audio/${this.tracks[region] || "space"}.mp3`;
    if (this.music?.getAttribute("src") === src) {
      this.music.play().catch(() => {});
      return;
    }
    this.music?.pause();
    this.music = new Audio(src);
    this.music.loop = true;
    this.music.volume = this.musicVolume;
    this.music.play().catch(() => {});
  },
  play(type) {
    if (!this.enabled || !this.effects[type] || this.active.size > 10) return;
    const a = new Audio(`/assets/audio/${this.effects[type]}`);
    a.volume = this.volume;
    a.playbackRate = type === "hit" ? 0.9 + Math.random() * 0.2 : 1;
    this.active.add(a);
    const end = () => this.active.delete(a);
    a.onended = end;
    a.onerror = end;
    a.play().catch(end);
  },
  setMusic(v) {
    this.musicVolume = v;
    if (this.music) this.music.volume = v;
  },
};
