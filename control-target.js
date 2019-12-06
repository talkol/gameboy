AFRAME.registerComponent("control-target", {

  init: function() {
    
    var keyConfig = {
		A: 88,
		B: 90,
		SELECT: 32,
		START: 13,
		UP: 38,
		DOWN: 40,
		LEFT: 37,
		RIGHT: 39
	  }
    
    let abutton = document.createElement("a-sphere");
    abutton.setAttribute("material", {"visible":false});
    //abutton.setAttribute("color", "red");
    abutton.setAttribute("radius", 0.12);
    //abutton.setAttribute("opacity", 0.5);
    abutton.setAttribute("position", {x:0.78, y:-0.11, z:0.05});
    abutton.keyCode = keyConfig.A;
    this.el.appendChild(abutton);
    
    let bbutton = document.createElement("a-sphere");
    bbutton.setAttribute("material", {"visible":false});
    //bbutton.setAttribute("color", "red");
    bbutton.setAttribute("radius", 0.12);
    //bbutton.setAttribute("opacity", 0.5);
    bbutton.setAttribute("position", {x:0.47, y:-0.24, z:0.05});
    bbutton.keyCode = keyConfig.B;
    this.el.appendChild(bbutton);
    
    let rbutton = document.createElement("a-sphere");
    rbutton.setAttribute("material", {"visible":false});
    //rbutton.setAttribute("color", "red");
    rbutton.setAttribute("radius", 0.1);
    //rbutton.setAttribute("opacity", 0.5);
    rbutton.setAttribute("position", {x:-0.44, y:-0.22, z:0.05});
    rbutton.keyCode = keyConfig.RIGHT;
    this.el.appendChild(rbutton);
    
    let lbutton = document.createElement("a-sphere");
    lbutton.setAttribute("material", {"visible":false});
    //lbutton.setAttribute("color", "red");
    lbutton.setAttribute("radius", 0.1);
    //lbutton.setAttribute("opacity", 0.5);
    lbutton.setAttribute("position", {x:-0.74, y:-0.22, z:0.05});
    lbutton.keyCode = keyConfig.LEFT;
    this.el.appendChild(lbutton);
    
    let ubutton = document.createElement("a-sphere");
    ubutton.setAttribute("material", {"visible":false});
    //ubutton.setAttribute("color", "red");
    ubutton.setAttribute("radius", 0.1);
    //ubutton.setAttribute("opacity", 0.5);
    ubutton.setAttribute("position", {x:-0.59, y:-0.07, z:0.05});
    ubutton.keyCode = keyConfig.UP;
    this.el.appendChild(ubutton);
    
    let dbutton = document.createElement("a-sphere");
    dbutton.setAttribute("material", {"visible":false});
    //dbutton.setAttribute("color", "red");
    dbutton.setAttribute("radius", 0.1);
    //dbutton.setAttribute("opacity", 0.5);
    dbutton.setAttribute("position", {x:-0.59, y:-0.37, z:0.05});
    dbutton.keyCode = keyConfig.DOWN;
    this.el.appendChild(dbutton);
    
    let start = document.createElement("a-sphere");
    start.setAttribute("material", {"visible":false});
    //start.setAttribute("color", "red");
    start.setAttribute("radius", 0.12);
    //start.setAttribute("opacity", 0.5);
    start.setAttribute("position", {x:0.13, y:-0.79, z:0});
    start.keyCode = keyConfig.START;
    this.el.appendChild(start);
    
    let select = document.createElement("a-sphere");
    select.setAttribute("material", {"visible":false});
    //select.setAttribute("color", "red");
    select.setAttribute("radius", 0.12);
    //select.setAttribute("opacity", 0.5);
    select.setAttribute("position", {x:-0.17, y:-0.79, z:0});
    select.keyCode = keyConfig.SELECT;
    this.el.appendChild(select);
    
    this.el.addEventListener("hit", function (evt) {
      //evt.target.setAttribute("color", "blue");
      if (evt.target.keyCode) {
        window.gbc.handleKeyDown(evt.target.keyCode);
      }
    });
    
    this.el.addEventListener("hitend", function (evt) {
      //evt.target.setAttribute("color", "red");
      if (evt.target.keyCode) {
        window.gbc.handleKeyUp(evt.target.keyCode); 
      }
    });
    
  }
  
});