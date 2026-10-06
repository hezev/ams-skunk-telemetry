(()=>{
  const GROUP_SELECTORS=[
    ".metrics",
    ".layout-main",
    ".dashboard-lower",
    ".live-summary",
    ".engineering-overview",
    ".analysis-tables",
    ".telemetry-grid",
    ".workspace-grid"
  ];

  const slug=value=>String(value||"module")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60);

  const currentView=()=>document.querySelector(".view.active");

  window.AMSLayout={
    editing:false,
    dragged:null,
    prefix:"ams_layout_v4",

    userKey(){
      return window.AMSAuth?.user?.id||"guest";
    },

    storeKey(viewId){
      return this.prefix+":"+this.userKey()+":"+viewId;
    },

    groupType(group){
      for(const s of GROUP_SELECTORS){
        if(group.matches(s))return s.replace(".","");
      }
      return "group";
    },

    groupKey(group){
      const view=group.closest(".view");
      const type=this.groupType(group);
      const peers=[...view.querySelectorAll("."+type)].filter(x=>x.closest(".view")===view);
      return type+":"+Math.max(0,peers.indexOf(group));
    },

    moduleName(el){
      return el.querySelector(".card-title")?.textContent?.trim()
        || el.querySelector("span")?.textContent?.trim()
        || el.getAttribute("aria-label")
        || "Módulo";
    },

    moduleKey(el,index){
      if(el.dataset.layoutKey)return el.dataset.layoutKey;
      const own=el.id;
      const child=el.querySelector("[id]")?.id;
      const name=slug(this.moduleName(el));
      el.dataset.layoutKey=own||child||name||("module-"+index);
      return el.dataset.layoutKey;
    },

    prepare(){
      document.querySelectorAll(".view").forEach(view=>{
        let groupCount=0;
        GROUP_SELECTORS.forEach(selector=>{
          view.querySelectorAll(selector).forEach(group=>{
            if(group.closest(".view")!==view)return;
            group.classList.add("ams-layout-group");
            group.dataset.layoutGroup=group.dataset.layoutGroup||this.groupKey(group)||("group-"+groupCount++);
            [...group.children].forEach((el,i)=>{
              if(el.classList.contains("ams-module-tools"))return;
              el.classList.add("ams-layout-module");
              this.moduleKey(el,i);
              this.addTools(el);
            });
            this.bindGroup(group);
          });
        });
      });
      this.loadAll();
    },

    addTools(el){
      if(el.querySelector(":scope > .ams-module-tools"))return;
      const tools=document.createElement("div");
      tools.className="ams-module-tools";
      tools.innerHTML='<span class="ams-drag-handle" draggable="true" title="Mover">⋮⋮</span><button type="button" data-layout-action="size" title="Alterar largura">1×</button><button type="button" data-layout-action="hide" title="Ocultar">×</button>';
      el.appendChild(tools);

      const handle=tools.querySelector(".ams-drag-handle");
      handle.addEventListener("dragstart",e=>{
        if(!this.editing){e.preventDefault();return;}
        this.dragged=el;
        el.classList.add("ams-dragging");
        e.dataTransfer.effectAllowed="move";
        e.dataTransfer.setData("text/plain",el.dataset.layoutKey||"module");
      });
      handle.addEventListener("dragend",()=>{
        el.classList.remove("ams-dragging");
        this.dragged=null;
        this.saveCurrent();
      });

      tools.querySelector('[data-layout-action="size"]').addEventListener("click",()=>{
        const sizes=["1","2","full"];
        const current=el.dataset.layoutSize||"1";
        const next=sizes[(sizes.indexOf(current)+1)%sizes.length];
        this.setSize(el,next);
        this.saveCurrent();
        this.rebuildPanel();
      });

      tools.querySelector('[data-layout-action="hide"]').addEventListener("click",()=>{
        el.classList.add("ams-layout-hidden");
        this.saveCurrent();
        this.rebuildPanel();
      });
    },

    setSize(el,size){
      el.dataset.layoutSize=size;
      el.classList.remove("ams-span-1","ams-span-2","ams-span-full");
      el.classList.add(size==="full"?"ams-span-full":size==="2"?"ams-span-2":"ams-span-1");
      const b=el.querySelector(':scope > .ams-module-tools [data-layout-action="size"]');
      if(b)b.textContent=size==="full"?"FULL":size+"×";
    },

    bindGroup(group){
      if(group.dataset.layoutBound)return;
      group.dataset.layoutBound="1";
      group.addEventListener("dragover",e=>{
        if(!this.editing||!this.dragged)return;
        if(this.dragged.parentElement!==group)return;
        e.preventDefault();
        e.dataTransfer.dropEffect="move";
        const target=e.target.closest(".ams-layout-module");
        if(!target||target===this.dragged||target.parentElement!==group)return;

        const r=target.getBoundingClientRect();
        const horizontal=Math.abs(e.clientX-(r.left+r.width/2))>Math.abs(e.clientY-(r.top+r.height/2));
        const before=horizontal ? e.clientX<r.left+r.width/2 : e.clientY<r.top+r.height/2;
        group.insertBefore(this.dragged,before?target:target.nextSibling);
      });
      group.addEventListener("drop",e=>{
        if(!this.editing||!this.dragged)return;
        e.preventDefault();
        this.saveCurrent();
        this.rebuildPanel();
      });
    },

    injectToolbar(){
      if(document.getElementById("layoutEditBtn"))return;
      const top=document.querySelector(".top-actions");
      if(!top)return;

      const btn=document.createElement("button");
      btn.id="layoutEditBtn";
      btn.className="layout-edit-btn";
      btn.type="button";
      btn.textContent="Editar layout";
      btn.addEventListener("click",()=>this.toggleEdit());
      top.insertBefore(btn,top.firstChild);

      const panel=document.createElement("aside");
      panel.id="layoutPanel";
      panel.className="layout-panel";
      panel.innerHTML='<div class="layout-panel-head"><div><strong>Personalizar layout</strong><span>Mover · redimensionar · ocultar</span></div><button id="layoutPanelClose" type="button">×</button></div><div id="layoutPanelList" class="layout-panel-list"></div><div class="layout-panel-actions"><button id="layoutResetView" type="button">Repor página</button><button id="layoutDone" type="button">Concluir</button></div>';
      document.body.appendChild(panel);

      panel.querySelector("#layoutPanelClose").addEventListener("click",()=>this.setEdit(false));
      panel.querySelector("#layoutDone").addEventListener("click",()=>this.setEdit(false));
      panel.querySelector("#layoutResetView").addEventListener("click",()=>this.resetCurrent());

      document.querySelectorAll("#mainNav button").forEach(nav=>nav.addEventListener("click",()=>{
        setTimeout(()=>{this.applyCurrent();this.rebuildPanel();},0);
      }));
    },

    toggleEdit(){ this.setEdit(!this.editing); },

    setEdit(value){
      this.editing=Boolean(value);
      document.body.classList.toggle("ams-layout-editing",this.editing);
      document.getElementById("layoutPanel")?.classList.toggle("open",this.editing);
      const btn=document.getElementById("layoutEditBtn");
      if(btn){
        btn.classList.toggle("active",this.editing);
        btn.textContent=this.editing?"A editar":"Editar layout";
      }
      this.rebuildPanel();
    },

    serializeView(view){
      const groups={};
      view.querySelectorAll(".ams-layout-group").forEach(group=>{
        if(group.closest(".view")!==view)return;
        groups[group.dataset.layoutGroup]=[...group.children]
          .filter(el=>el.classList.contains("ams-layout-module"))
          .map(el=>({
            key:el.dataset.layoutKey,
            size:el.dataset.layoutSize||"1",
            hidden:el.classList.contains("ams-layout-hidden")
          }));
      });
      return {groups,updatedAt:Date.now()};
    },

    saveCurrent(){
      const view=currentView();if(!view)return;
      try{localStorage.setItem(this.storeKey(view.id),JSON.stringify(this.serializeView(view)));}catch{}
    },

    read(view){
      try{return JSON.parse(localStorage.getItem(this.storeKey(view.id))||"null");}catch{return null;}
    },

    applyView(view){
      const saved=this.read(view);if(!saved?.groups)return;
      view.querySelectorAll(".ams-layout-group").forEach(group=>{
        if(group.closest(".view")!==view)return;
        const rows=saved.groups[group.dataset.layoutGroup];
        if(!Array.isArray(rows))return;
        const map=new Map([...group.children].filter(x=>x.classList.contains("ams-layout-module")).map(x=>[x.dataset.layoutKey,x]));
        rows.forEach(row=>{
          const el=map.get(row.key);if(!el)return;
          group.appendChild(el);
          this.setSize(el,row.size||"1");
          el.classList.toggle("ams-layout-hidden",Boolean(row.hidden));
        });
      });
    },

    applyCurrent(){const v=currentView();if(v)this.applyView(v);},

    loadAll(){
      document.querySelectorAll(".view").forEach(v=>this.applyView(v));
      this.rebuildPanel();
    },

    resetCurrent(){
      const view=currentView();if(!view)return;
      localStorage.removeItem(this.storeKey(view.id));
      view.querySelectorAll(".ams-layout-module").forEach(el=>{
        el.classList.remove("ams-layout-hidden","ams-span-2","ams-span-full");
        this.setSize(el,"1");
      });
      location.reload();
    },

    rebuildPanel(){
      const list=document.getElementById("layoutPanelList"),view=currentView();
      if(!list||!view)return;
      list.innerHTML="";
      view.querySelectorAll(".ams-layout-group").forEach(group=>{
        if(group.closest(".view")!==view)return;
        const section=document.createElement("div");
        section.className="layout-panel-section";
        const title=document.createElement("h4");
        title.textContent=this.groupType(group).replace(/-/g," ");
        section.appendChild(title);

        [...group.children].filter(el=>el.classList.contains("ams-layout-module")).forEach(el=>{
          const row=document.createElement("label");
          row.className="layout-panel-row";
          row.innerHTML='<input type="checkbox" '+(!el.classList.contains("ams-layout-hidden")?"checked":"")+'><span>'+this.moduleName(el)+'</span><b>'+(el.dataset.layoutSize==="full"?"FULL":(el.dataset.layoutSize||"1")+"×")+'</b>';
          row.querySelector("input").addEventListener("change",e=>{
            el.classList.toggle("ams-layout-hidden",!e.target.checked);
            this.saveCurrent();
          });
          section.appendChild(row);
        });
        list.appendChild(section);
      });
    },

    init(){
      this.injectToolbar();
      this.prepare();
      document.addEventListener("ams-auth-changed",()=>setTimeout(()=>this.loadAll(),0));
    }
  };

  AMSLayout.init();
})();