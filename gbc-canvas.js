AFRAME.registerComponent('gbc-canvas', {
    schema: {default: ''},

    init: function () {
      let canvas = document.getElementById("screen");
      let drawing = new Image();
      drawing.onload = function() {
        canvas.getContext("2d").drawImage(drawing, 0, 0);
      };
      drawing.crossOrigin = "anonymous";
      drawing.src = "assets/pointgame.png";
      
      this.el.sceneEl.addEventListener('enter-vr', function () {
        if (window.gbc) {
          window.gbc.paused = false;
        }
      });
      
      this.el.sceneEl.addEventListener('exit-vr', function () {
        if (window.gbc) {
          window.gbc.paused = true;
        }
      });
      
    }
  
});