AFRAME.registerComponent("controls", {

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
    
    let self = this;
    window.controls = this;
    this.els = [];
    this.radiuses = [];
    this.rightClicked = -1;
    this.rightPointed = false;
    this.leftClicked = -1;
    this.leftPointed = false;

    let right = document.createElement("a-entity");
    right.setAttribute("hand-controls", "right");
    right.addEventListener("gripdown", function (evt) {
      self.rightPointed = true;
    });
    right.addEventListener("gripup", function (evt) {
      self.rightPointed = false;
    });
    right.addEventListener("abuttondown", function (evt) {
      window.gbc.handleKeyDown(keyConfig.A);
    });
    right.addEventListener("abuttonup", function (evt) {
      window.gbc.handleKeyUp(keyConfig.A);
    });
    right.addEventListener("bbuttondown", function (evt) {
      window.gbc.handleKeyDown(keyConfig.B);
    });
    right.addEventListener("bbuttonup", function (evt) {
      window.gbc.handleKeyUp(keyConfig.B);
    });
    this.el.appendChild(right);
    
    this.rightCollider = document.createElement("a-entity"); // a-sphere
    //this.rightCollider.setAttribute("color", "yellow");
    //this.rightCollider.setAttribute("radius", 0.01);
    //this.rightCollider.setAttribute("opacity", 0.5);
    this.rightCollider.setAttribute("position", {x:-0.035, y:0.015, z:-0.1});
    right.appendChild(this.rightCollider);
    
    let left = document.createElement("a-entity");
    left.setAttribute("hand-controls", "left");
    left.addEventListener("gripdown", function (evt) {
      self.leftPointed = true;
    });
    left.addEventListener("gripup", function (evt) {
      self.leftPointed = false;
    });
    let leftPressed = false;
    let rightPressed = false;
    let upPressed = false;
    let downPressed = false;
    left.addEventListener("thumbstickmoved", function (evt) {
      let x = evt.detail.x;
      let y = evt.detail.y;
      if (x > 0.5) {
        if (leftPressed) { leftPressed = false; window.gbc.handleKeyUp(keyConfig.LEFT); }
        if (!rightPressed) { rightPressed = true; window.gbc.handleKeyDown(keyConfig.RIGHT); }
      } else if (x < -0.5) {
        if (rightPressed) { rightPressed = false; window.gbc.handleKeyUp(keyConfig.RIGHT); }
        if (!leftPressed) { leftPressed = true; window.gbc.handleKeyDown(keyConfig.LEFT); }
      } else {
        if (leftPressed) { leftPressed = false; window.gbc.handleKeyUp(keyConfig.LEFT); }
        if (rightPressed) { rightPressed = false; window.gbc.handleKeyUp(keyConfig.RIGHT); }
      }
      if (y < -0.5) {
        if (downPressed) { downPressed = false; window.gbc.handleKeyUp(keyConfig.DOWN); }
        if (!upPressed) { upPressed = true; window.gbc.handleKeyDown(keyConfig.UP); }
      } else if (y > 0.5) {
        if (upPressed) { upPressed = false; window.gbc.handleKeyUp(keyConfig.UP); }
        if (!downPressed) { downPressed = true; window.gbc.handleKeyDown(keyConfig.DOWN); }
      } else {
        if (downPressed) { downPressed = false; window.gbc.handleKeyUp(keyConfig.DOWN); }
        if (upPressed) { upPressed = false; window.gbc.handleKeyUp(keyConfig.UP); }
      }
    });
    this.el.appendChild(left);
    
    this.leftCollider = document.createElement("a-entity"); // a-sphere
    //this.leftCollider.setAttribute("color", "yellow");
    //this.leftCollider.setAttribute("radius", 0.01);
    //this.leftCollider.setAttribute("opacity", 0.5);
    this.leftCollider.setAttribute("position", {x:0.045, y:0.015, z:-0.1});
    left.appendChild(this.leftCollider);
    
  },
  
  refreshEls: function() {
    let objectEls = this.el.sceneEl.querySelectorAll("a-sphere");
    this.els = Array.prototype.slice.call(objectEls);
    this.radiuses = this.els.map(function (el) {
      return Number(el.getAttribute("radius"));
    });
  },
  
  play: function() {
    this.refreshEls();
  },
  
  tick: function() {
    this.rightClicked = this.checkCollider(this.rightCollider, this.rightClicked, this.rightPointed);
    this.leftClicked = this.checkCollider(this.leftCollider, this.leftClicked, this.leftPointed);
  },
  
  checkCollider: function(collider, clicked, pointed) {
    const position = new THREE.Vector3();
    const targetPosition = new THREE.Vector3();
    const targetScale = new THREE.Vector3();
    collider.object3D.getWorldPosition(position);
    if (clicked == -1) {
      if (pointed) {
        for (let i=0; i<this.els.length; i++) {
          let el = this.els[i];
          el.object3D.getWorldPosition(targetPosition);
          el.object3D.getWorldScale(targetScale);
          let distance = position.distanceTo(targetPosition);
          if (distance < this.radiuses[i] * targetScale.x) {
            el.emit('hit', {target: el});
            return i;
          }
        }
      }
    } else {
      let i = clicked;
      let el = this.els[i];
      if (!pointed) {
        el.emit('hitend', {target: el});
        return -1;
      } else {  
        el.object3D.getWorldPosition(targetPosition);
        el.object3D.getWorldScale(targetScale);
        let distance = position.distanceTo(targetPosition);
        if (distance > this.radiuses[i] * targetScale.x) {
          el.emit('hitend', {target: el});
          return -1;
        }  
      }
    }
    return clicked;
  }
  
});