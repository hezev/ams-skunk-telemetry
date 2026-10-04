window.AMSTrack = {
  phase:0,
  tick(){
    this.phase+=0.04;
    const dot=document.getElementById("carDot");
    if(!dot) return;
    const x=50+Math.cos(this.phase)*34;
    const y=50+Math.sin(this.phase*1.18)*29;
    dot.style.left=x+"%";
    dot.style.top=y+"%";
  }
};
