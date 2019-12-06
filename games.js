AFRAME.registerComponent('games', {
  
  init: function () {
    
    let self = this;
    
    let jsonUrl = AFRAME.utils.getUrlParameter('roms');
    if (!jsonUrl) {
      let noroms = document.getElementById("noroms");
      noroms.style.display = "block";
      return;
    }
    
    fetch(jsonUrl).then(function(response) {
      return response.json();
    }).then(function(jsonResponse) {
      
      let db = jsonResponse;  
      for (let i=0; i<db.length; i++) {
        let game = document.createElement("a-entity");
        game.setAttribute("game", {rom:db[i].rom, img:db[i].img});
        let x = i / 3;
        let y = i % 3;
        game.setAttribute("position", {x:0.9, y:2 - y*0.5, z:-0.1 + x*0.5});
        game.setAttribute("scale", {x:1.2, y:1.2, z:1.2});
        game.setAttribute("rotation", {x:0, y:-90, z:0});
        game.setAttribute("animation", {property:"rotation", from:"0 -91.5 0", to:"0 -88.5 0", dir:"alternate", loop:true, delay:Math.random()*2*2000, dur:2000, easing:"easeInOutQuad"});
        self.el.appendChild(game);
      }
      
    });
    
  }

});