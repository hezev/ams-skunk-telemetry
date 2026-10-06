(()=>{
  const mount=document.getElementById("engineeringAnalysisMount");
  if(!mount)return;
  mount.innerHTML=`
    <article class="card engineering-controls">
      <div class="engineering-control-grid">
        <div>
          <span class="control-title">Zoom da volta</span>
          <div class="zoom-row">
            <label>Início <input id="zoomStart" type="range" min="0" max="99" value="0"><b id="zoomStartText">0%</b></label>
            <label>Fim <input id="zoomEnd" type="range" min="1" max="100" value="100"><b id="zoomEndText">100%</b></label>
            <button id="zoomResetBtn" class="action-btn" type="button">Reset</button>
          </div>
        </div>
        <div>
          <span class="control-title">Minissetores</span>
          <label><select id="miniSectorCount">
            <option value="10">10</option>
            <option value="20" selected>20</option>
            <option value="25">25</option>
            <option value="40">40</option>
          </select></label>
        </div>
        <div>
          <span class="control-title">Comparação</span>
          <strong id="analysisComparisonStatus">SEM REFERÊNCIA</strong>
        </div>
      </div>
    </article>

    <div id="analysisCursorReadout" class="analysis-cursor-readout">
      <div><span>Position</span><strong id="cursorPosition">—</strong></div>
      <div><span>Time A</span><strong id="cursorTimeA">—</strong></div>
      <div><span>Time Ref</span><strong id="cursorTimeB">—</strong></div>
      <div><span>Δ Time</span><strong id="cursorTimeDelta">—</strong></div>
      <div><span>Speed A / Ref</span><strong id="cursorSpeed">—</strong></div>
      <div><span>Brake A / Ref</span><strong id="cursorBrake">—</strong></div>
      <div><span>Throttle A / Ref</span><strong id="cursorThrottle">—</strong></div>
      <div><span>Gear A / Ref</span><strong id="cursorGear">—</strong></div>
    </div>

    <div class="engineering-overview">
      <article class="card">
        <div class="card-head">
          <div class="card-title">Gain / Loss Map</div>
          <div class="analysis-map-legend">
            <span class="gain">GAIN</span><span class="loss">LOSS</span>
            <span class="braking">BRAKE</span><span class="accel">THROTTLE</span>
          </div>
        </div>
        <div class="analysis-track-stage"><svg id="analysisTrackSvg" aria-label="Mapa de ganho e perda"></svg></div>
      </article>
      <article class="card">
        <div class="card-head"><div class="card-title">Cumulative Time Delta</div><div class="chip">A − REF</div></div>
        <div class="chart-wrap big"><canvas class="trace" data-trace="timeDelta"></canvas></div>
      </article>
    </div>

    <div class="analysis-tables">
      <article class="card table-card">
        <div class="card-title">Virtual Sectors · 3 × distance</div>
        <table class="analysis-table">
          <thead><tr><th>Sector</th><th>Range</th><th>Lap A</th><th>Ref</th><th>Δ</th><th>Speed min/max</th><th>Brake peak</th><th>Throttle avg</th></tr></thead>
          <tbody id="sectorAnalysisBody"></tbody>
        </table>
      </article>
      <article class="card table-card">
        <div class="card-head"><div class="card-title">Minisectors</div><div class="chip">click row to zoom</div></div>
        <table class="analysis-table">
          <thead><tr><th>MS</th><th>Range</th><th>A</th><th>Ref</th><th>Δ</th><th>Speed min/max</th><th>Brake</th><th>Throttle</th><th>Gear</th></tr></thead>
          <tbody id="miniSectorBody"></tbody>
        </table>
      </article>
      <article class="card table-card">
        <div class="card-title">Braking / Acceleration Points</div>
        <table class="analysis-table">
          <thead><tr><th>Type</th><th>Position</th><th>Speed</th><th>Peak/Input</th><th>Duration</th><th>Ref offset</th></tr></thead>
          <tbody id="drivingEventsBody"></tbody>
        </table>
      </article>
    </div>
  `;
})();