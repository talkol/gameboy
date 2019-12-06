AFRAME.registerComponent('game', {
  schema: {
    rom: {default: ''},
    img: {default: ''}
  },
  
  init: function() {
    
    let model = document.createElement("a-entity");
    model.setAttribute("gltf-model", "#game");
    model.setAttribute("scale", {x:0.005, y:0.005, z:0.005});
    this.el.appendChild(model);
    
    let image = document.createElement("a-image");
    image.setAttribute("position", {x:0, y:-0.021, z:0.031});
    image.setAttribute("width", 0.20);
    image.setAttribute("height", 0.175);
    image.setAttribute("src", this.data.img);
    this.el.appendChild(image);
    
    let choose = document.createElement("a-sphere");
    choose.setAttribute("material", {"visible":false});
    //choose.setAttribute("color", "red");
    choose.setAttribute("radius", 0.18);
    //choose.setAttribute("opacity", 0.5);
    choose.setAttribute("position", {x:0, y:0, z:0.03});
    this.el.appendChild(choose);
    
    let rom = this.data.rom;
    this.el.addEventListener("hit", function (evt) {
      let canvas = document.getElementById("screen");
      if (window.gbc) {
        window.gbc.paused = true;
      }
      window.gbc = new gb(rom, canvas);
    });
    
  },
  
  play: function() {
    window.controls.refreshEls();  
  }
  
});