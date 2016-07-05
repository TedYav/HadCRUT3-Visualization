var temperatureData = function(){
    var startYear = 1910;
    var endYear = 2010;
    var yearsPerLayer = 10;   // how many years of data each temperature layer contains
    var indicesPerLayer = yearsPerLayer * 12;
    var map;

    // holds extra handlers so this can be DOM agnostic
    var handlers = []

    var layers = {};
    var layerIDs = {
        2000 : 'teomandavid.avnfqc1r',
        1990 : 'teomandavid.2q15bd1p',
        1980 : 'teomandavid.dwjd1l7o',
        1970 : 'teomandavid.99nzb97y',
        1960 : 'teomandavid.cx64qvfm',
        1950 : 'teomandavid.bm4fjc6s',
        1940 : 'teomandavid.14p7nv2b',
        1930 : 'teomandavid.2al32fa3',
        1920 : 'teomandavid.642l79dx',
        1910 : 'teomandavid.2nbuz6i3'
    }

    var loop = false;

    var prevYear = 2000;
    var currentYear = 2000;
    var currentMonth = 0;
    var currentIndex = 0;

    function getBaseYear(year){
        return year - (year%yearsPerLayer);
    }
    function getLayerName(year){
        var start = getBaseYear(year);
        var end = start + yearsPerLayer;
        return "climate" + start + "-" + end;
    }

    function generateLayers(){
        for(var year = startYear; year < endYear; year += yearsPerLayer){
            // add layers as sources
            map.addSource(getLayerName(year), {
                type: 'vector',
                url: 'mapbox://' + layerIDs[year]
            });

            // generate layer objects for quick access
            // they are all single layer vector sets
            // so we don't need to worry about separate layer names and ids etc
            layers[year] = {
                    'id': getLayerName(year),
                    'type': 'circle',
                    'source': getLayerName(year),
                    'source-layer': getLayerName(year),
                    'paint': {
                        'circle-radius': {
                            //'base': 500,
                            'type': 'exponential',
                            'stops': [[2, 60], [6, 600]]
                        },
                        // color circles by ethnicity, using data-driven styles
                        'circle-color': {
                            property: "0",
                            type: 'exponential',
                            stops: [
                                [-20, '#0000ff'],
                                [50 , '#ff0000']
                            ]
                        },
                        'circle-opacity': 0.125,
                        'circle-blur': 1
                    }
                };
        }
    }

    function invalidIndex(){
      return currentIndex + currentMonth >= indicesPerLayer || currentIndex + currentMonth < 0;
    }

    function updateLayer(){
        // if it's an invalid year, just snap to the end
        if(currentYear > endYear){
          currentYear = endYear;
          currentIndex = (yearsPerLayer - 1) * 12;
        }else if(currentYear < startYear){
          currentYear = startYear;
          currentIndex = 0;
        }
        // otherwise change the layer
        else{
          reload = true;
          // only one of these loops will run
          while(currentIndex >= indicesPerLayer){
            currentIndex -= indicesPerLayer;
          }
          while(currentIndex < 0){
            currentIndex += indicesPerLayer;
          }
          map.addLayer(layers[getBaseYear(currentYear)], 'overlay');
          layerToRemove = getLayerName(prevYear);
          setTimeout(function(){map.removeLayer(layerToRemove);}, 100);
        }
    }

    function updateMap(){
        // console.log("UPDATING: " + currentIndex + " YEAR " + currentYear);
        if(invalidIndex()){
          updateLayer();
        }

        map.setPaintProperty(getLayerName(currentYear), "circle-color", {
            property: "" + currentIndex,
                type: 'exponential',
                stops: [
                        [-20, "#0000ff"],
                        [50 , "#ff0000"]
                ]
        });
    }

    function updateYear(year){
      offset = year - currentYear;
      currentIndex += offset * 12;
      prevYear = currentYear;
      currentYear = year;
      updateMap();
      changed();
    }

    function updateMonth(month){
      currentMonth = month;
      updateMap();
      changed();
    }

    function changed(){
      handlers.forEach(function(handler){
        handler();
      });
    }

    return {
      init: function(newMap, startYear){
          map = newMap;
          generateLayers();
          currentYear = startYear;
          prevYear = startYear;
          map.addLayer(layers[getBaseYear(currentYear)], 'overlay');
          updateMap();
          changed();
      },
      setYear: function(year){
          updateYear(year);
      },
      setMonth: function(month){
          updateMonth(month);
      },
      iterate : function(){
          if(currentYear < endYear  - 1){
            updateYear(currentYear + 1);
          }
          else{
            updateYear(startYear);
          }
      },
      getYearRange : function(){
        return [startYear, endYear];
      },
      getCurrentYear : function(){
        return currentYear;
      },
      getCurrentMonth : function(){
        return currentMonth;
      },
      onChange : function(handler){
        handlers.push(handler);
      }
    }
}();

mapboxgl.accessToken = 'pk.eyJ1IjoidGVvbWFuZGF2aWQiLCJhIjoiY2lwaHBrNnp4MDE2Z3RsbmpxeWVkbXhxMSJ9.rhKrjQ0Eb8iH0inNPQ7W8Q';




var waterLayer = {
    'id': 'water',
    'source': 'overlay',
    'source-layer': 'water',
    'type': 'fill',
    'paint' : {
      'fill-color' : '#7788ff'
    }
};

var overlayLayer = {
    'id': 'overlay',
    'source': 'overlay',
    'source-layer': 'admin',
    'type': 'line'
};

var infoLayer = {
    'id' : 'info',
    'source' : 'headers',
    'type' : 'circle',
    'source-layer' : 'climateheaders',
    // 'minzoom': 3,
    // 'maxzoom': 10,
    'paint': {
        // make circles larger as the user zooms from z12 to z22
        'circle-radius': {
          'stops': [[2, 1], [3,5]]
        },
        // color circles by ethnicity, using data-driven styles
        'circle-color': '#000',
        'circle-opacity': 0.5
    }
}

$(document).ready(function(){
  var map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/light-v9',
      zoom: 2,
      minZoom: 2,
      maxZoom: 6,
      center: [5.425411010332567, 51.22556912180988]
  });

  map.on('load', function () {
      map.addSource('overlay', {
          type: 'vector',
          url: 'mapbox://mapbox.mapbox-streets-v7'
      });
      map.addSource('headers', {
          type: 'vector',
          url: 'mapbox://teomandavid.2sbag4dt'
      })
      map.addLayer(waterLayer);
      //map.addLayer(tempLayer);
      map.addLayer(overlayLayer);
      //map.addLayer(infoLayer);
      temperatureData.init(map, 2000);
      //setInterval(temperatureData.iterate, 250);
  });

  console.log()
  // register update function w/tempdata
  $('#map-controls').slider({
    animate: 'fast',
    max: temperatureData.getYearRange()[1] - 1,
    min: temperatureData.getYearRange()[0],
    value: temperatureData.getCurrentYear(),
    slide: function(event, ui){
      $('#map-data').text("Year: " + ui.value);
    },
    stop: function(event, ui){
      temperatureData.setYear(ui.value);
    }
  });

  temperatureData.onChange(function(){
    $('#map-data').text("Year: " + temperatureData.getCurrentYear());


    $('#map-controls').slider("option", "value", temperatureData.getCurrentYear());
  });

  var buttonHandler = function(){
      var playing = false;
      var intervalID;
      return function(){
          if(playing){
            $('#playpause').text("Play! :-)");
            window.clearInterval(intervalID);
            playing = false;
          }
          else{
            intervalID = window.setInterval(temperatureData.iterate, 250);
            $('#playpause').text("Stop! :-(");
            playing = true;
          }
      }
  }();

  $('#playpause').on('click', buttonHandler);

});
