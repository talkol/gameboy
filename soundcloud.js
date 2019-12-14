AFRAME.registerComponent('soundcloud', {
  
  init: function () {
    try {
      if (typeof SC !== "undefined") {
        SC.client_id = 'b1275b704badf79d972d51aa4b92ea15';
        SC.initialize({
          client_id: SC.client_id
        });
      }
      else {
        SC = null;
      }
    }
    catch (e) {
      SC = null;
    }
  },
  
  play: function () {
    if (SC == null) return;
    let playing = false;
    let button = document.getElementsByClassName("a-enter-vr-button")[0];
    button.addEventListener("click", function() {
      if (playing) return;
      playing = true;
      function playSound() {
        SC.stream('/tracks/648410951').then(function(player) {
          player.setVolume(0.2);
          player.play();
          player.on('finish', playSound);
        });
      }
      playSound();
    });  
  }

});