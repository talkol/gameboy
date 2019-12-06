AFRAME.registerComponent('canvas-updater', {
  
  dependencies:['geometry','material'],
  
  init: function () {
    var el = this.el;
    this.material = el.getObject3D('mesh').material;
  },
  
  tick: function() {
    if (!this.material.map) return;
    this.material.map.needsUpdate = true;
  }

});