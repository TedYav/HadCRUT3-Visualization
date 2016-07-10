function updateMap(){
  var props = ['circle-color', 'circle-opacity'];
  updateStyle(currentMonth, props);
  changed();
}

function updateStyle(layer, props = undefined){
  var style = circleStyles[currentStyle](currentIndex);
  if(!props){ props = Object.keys(style); }
  props.forEach(function(prop){
    if(prop in style){
      map.setPaintProperty(currentMonth, prop, style[prop]);
    }
  });
}

function loadStyle(style){
    var props = ['circle-color', 'circle-opacity', 'circle-radius', 'circle-blur'];
    currentStyle = style;
    months.forEach(function(month){
      updateStyle(month);
    });
}
