(()=>{
  const q=s=>document.querySelector(s);
  const qa=s=>[...document.querySelectorAll(s)];

  function switchView(id){
    qa(".view").forEach(v=>v.classList.toggle("active",v.id===id));
    qa("#mainNav button").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
    requestAnimationFrame(()=>AMSCharts.drawAll(AMSRealtime.phase));
  }

  qa("#mainNav button").forEach(btn=>btn.addEventListener("click",()=>switchView(btn.dataset.view)));

  const timing=q("#timingBody");
  AMSMock.drivers.forEach(d=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><strong>${d.pos}</strong></td><td><strong>${d.driver}</strong><br><small>${d.number}</small></td><td>${d.car}</td><td>${d.lap}</td><td>${d.last}</td><td>${d.best}</td><td class="${d.delta.startsWith("-")?"green":"red"}">${d.delta}</td><td>${d.gap}</td>`;
    timing.appendChild(tr);
  });

  const sessions=q("#sessionsBody");
  AMSMock.sessions.forEach(s=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${s.date}</td><td>${s.sim}</td><td>${s.track}</td><td>${s.car}</td><td>${s.laps}</td><td>${s.best}</td><td><span class="status ${s.status}">${s.status==="live"?"Live":"Complete"}</span></td>`;
    sessions.appendChild(tr);
  });

  const laps=q("#lapsBody");
  AMSMock.laps.forEach(l=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${l.lap}</td><td><strong>${l.time}</strong></td><td>${l.s1}</td><td>${l.s2}</td><td>${l.s3}</td><td class="${l.delta==="PB"?"green":"red"}">${l.delta}</td><td>${l.fuel} L</td>`;
    laps.appendChild(tr);
  });

  const records=q("#recordsBody");
  AMSMock.records.forEach(r=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><strong>${r.rank}</strong></td><td>${r.driver}</td><td>${r.car}</td><td>${r.track}</td><td><strong>${r.time}</strong></td>`;
    records.appendChild(tr);
  });

  window.addEventListener("resize",()=>AMSCharts.drawAll(AMSRealtime.phase));
  AMSCharts.drawAll();
  AMSRealtime.start();
})();
