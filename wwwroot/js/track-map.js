window.AMSTrack = {
  phase: 0,
  progress: 0,
  index: null,
  activeEntry: null,
  activePath: null,

  normalize(value){
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  },

  encodePath(path){
    return String(path).split("/").map(encodeURIComponent).join("/");
  },

  collectStrings(obj){
    return Object.values(obj || {})
      .filter(v => typeof v === "string" && v.length < 500)
      .map(v => v.trim())
      .filter(Boolean);
  },

  buildIndex(data){
    const found = [];
    const seen = new Set();
    const categories = ["Road", "Oval", "Dirt Road", "Dirt Oval"];

    const walk = (node, parents=[]) => {
      if(Array.isArray(node)){
        node.forEach(v => walk(v, parents));
        return;
      }
      if(!node || typeof node !== "object") return;

      const direct = this.collectStrings(node);
      const context = [...parents, ...direct].slice(-24);

      let localPath = null;
      let cdnBase = null;

      for(const s of direct){
        const clean = s.replace(/\\/g, "/");

        const category = categories.find(c => clean.startsWith(c + "/"));
        if(category && clean.split("/").length >= 3){
          const pieces = clean.split("/");
          localPath = pieces.slice(0,3).join("/");
        }

        if(clean.includes("members-assets.iracing.com/public/track-maps/")){
          const ix = clean.indexOf("https://");
          if(ix >= 0){
            const url = clean.slice(ix).split(/[?#]/)[0].replace(/\/(active|background|inactive|pitroad|start-finish|turns)\.svg$/i,"");
            cdnBase = url.replace(/\/$/,"");
          }
        }
      }

      if(localPath || cdnBase){
        const key = localPath || cdnBase;
        if(!seen.has(key)){
          seen.add(key);
          const search = this.normalize(context.join(" "));
          const parts = localPath ? localPath.split("/") : [];
          found.push({
            localPath,
            cdnBase,
            category: parts[0] || "",
            family: parts[1] || "",
            config: parts[2] || "",
            search
          });
        }
      }

      const parentContext = context.filter(s => s.length < 120);
      Object.values(node).forEach(v => {
        if(v && typeof v === "object") walk(v, parentContext);
      });
    };

    walk(data);
    return found;
  },

  aliases(target){
    const n = this.normalize(target);
    const extra = [];
    if(n.includes("algarve") || n.includes("portimao")) extra.push("portimao", "algarve");
    if(n.includes("spa")) extra.push("spa francorchamps", "spa");
    if(n.includes("nurburgring") || n.includes("nuerburgring")) extra.push("nurburgring", "nuerburgring");
    if(n.includes("le mans")) extra.push("lemans");
    return [n, ...extra];
  },

  async getIndex(){
    if(this.index) return this.index;

    const cached = sessionStorage.getItem("ams_track_index_v1");
    if(cached){
      try{
        this.index = JSON.parse(cached);
        return this.index;
      }catch{}
    }

    const res = await fetch(AMS_CONFIG.trackMetadataUrl, {cache:"force-cache"});
    if(!res.ok) throw new Error("Não foi possível carregar o catálogo de pistas.");
    const data = await res.json();

    this.index = this.buildIndex(data);

    try{
      sessionStorage.setItem("ams_track_index_v1", JSON.stringify(this.index));
    }catch{}

    return this.index;
  },

  score(entry, trackName, configHint=""){
    const targets = this.aliases(trackName);
    const hint = this.normalize(configHint);
    let score = 0;

    for(const target of targets){
      if(!target) continue;
      if(entry.search.includes(target)) score = Math.max(score, 120);
      const words = target.split(" ").filter(x => x.length > 2);
      if(words.length && words.every(w => entry.search.includes(w))) score = Math.max(score, 90);
      score += words.filter(w => entry.search.includes(w)).length * 6;
    }

    if(hint){
      if(entry.search.includes(hint)) score += 80;
      const words = hint.split(" ").filter(x=>x.length>2);
      score += words.filter(w=>entry.search.includes(w)).length * 8;
    }

    if(/grand.?prix|gp\b/i.test(entry.config)) score += 2;
    return score;
  },

  async resolve(trackName, configHint=""){
    const index = await this.getIndex();
    if(!index.length) return null;

    return index
      .map(entry => ({entry, score:this.score(entry, trackName, configHint)}))
      .sort((a,b)=>b.score-a.score)[0]?.entry || null;
  },

  baseUrl(entry){
    if(entry.cdnBase) return entry.cdnBase;
    if(entry.localPath) return AMS_CONFIG.trackRawBase + "/" + this.encodePath(entry.localPath);
    return "";
  },

  async load(trackName, configHint=""){
    const status = document.getElementById("trackSource");
    try{
      if(status) status.textContent = "A localizar traçado…";
      const entry = await this.resolve(trackName, configHint);
      if(!entry) throw new Error("Traçado não encontrado.");

      this.activeEntry = entry;
      const base = this.baseUrl(entry);
      const stack = document.getElementById("trackVectorStack");
      if(!stack) return;

      stack.querySelectorAll("img.track-layer").forEach(img => img.remove());

      const layers = [
        ["background","background.svg"],
        ["inactive","inactive.svg"],
        ["active","active.svg"],
        ["pitroad","pitroad.svg"],
        ["startfinish","start-finish.svg"],
        ["turns","turns.svg"]
      ];

      for(const [cls,file] of layers){
        const img = document.createElement("img");
        img.className = "track-layer track-" + cls;
        img.alt = "";
        img.src = base + "/" + file;
        img.onerror = () => img.remove();
        stack.appendChild(img);
      }

      await this.prepareMotionPath(base + "/active.svg");

      if(status){
        status.textContent = [entry.family, entry.config].filter(Boolean).join(" · ") || trackName;
      }

      return entry;
    }catch(err){
      if(status) status.textContent = "Mapa indisponível";
      console.warn("AMS track map:", err);
      return null;
    }
  },

  async prepareMotionPath(url){
    this.activePath = null;
    const host = document.getElementById("trackMotionSvg");
    if(!host) return;

    try{
      const res = await fetch(url, {cache:"force-cache"});
      if(!res.ok) return;
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, "image/svg+xml");
      const src = doc.documentElement;
      const viewBox = src.getAttribute("viewBox");
      if(viewBox) host.setAttribute("viewBox", viewBox);

      host.innerHTML = src.innerHTML;
      const paths = [...host.querySelectorAll("path")];
      let best = null, bestLen = 0;
      for(const p of paths){
        try{
          const len = p.getTotalLength();
          if(len > bestLen){ best = p; bestLen = len; }
        }catch{}
      }
      this.activePath = best;
      this.setPosition(this.progress);
    }catch{}
  },

  setPosition(progress){
    const dot = document.getElementById("carDot");
    const svg = document.getElementById("trackMotionSvg");
    if(!dot || !svg || !this.activePath) return;

    const length = this.activePath.getTotalLength();
    const point = this.activePath.getPointAtLength((progress % 1) * length);
    const matrix = svg.getScreenCTM();
    if(!matrix) return;

    const screen = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    const stage = document.querySelector(".track-stage")?.getBoundingClientRect();
    if(!stage) return;

    dot.style.left = (screen.x - stage.left) + "px";
    dot.style.top = (screen.y - stage.top) + "px";
  },

  tick(trackPosition=null){
    this.phase += 0.04;
    this.progress = Number.isFinite(Number(trackPosition))
      ? Number(trackPosition)
      : (this.progress + 0.0018) % 1;

    this.setPosition(this.progress);
  }
};
