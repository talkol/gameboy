AFRAME.registerComponent("autoplay", {
  play: function() {
    let button = document.getElementsByClassName("a-enter-vr-button")[0];
    button.addEventListener("click", function() {
      let index = AFRAME.utils.getUrlParameter("i");
      if (!index) index = 0;
      let jsonUrl = AFRAME.utils.getUrlParameter("roms");
      if (!jsonUrl) return;

      fetch(jsonUrl)
        .then(function(response) {
          return response.json();
        })
        .then(function(jsonResponse) {
          let db = jsonResponse;
          let rom = db[index].rom;
          let canvas = document.getElementById("screen");
          if (window.gbc) {
            window.gbc.paused = true;
          }
          window.gbc = new gb(rom, canvas);
        });
    });
  }
});
