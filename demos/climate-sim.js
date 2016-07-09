var map;  // to avoid declaration problems below

/*
/   climateData: closure holding styling info and managing transitions
*/
var climateData = function(){

    /*
    /
    /   Variables -- configured according to map data
    /
    */


    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

    var myMap;

    var startYear = 1900;
    var endYear = 2010;
    var currentYear = 2000;
    var currentMonth = months[0];
    var currentIndex = currentYear - startYear;
    var currentStyle = 'solid';

    // holds extra handlers so this can be DOM agnostic
    var handlers = [];

    var loop = false;

    // function to set coloration style for layers
    var colorStyle = function(prop, range){
      return {
          property: "" + prop,
          type: 'exponential',
          stops: [
              [range[0], '#0000ff'],
              [range[1] , '#ff0000']
          ]
      };
    }

    // range which we're going to color temperatures
    var tempRange = [-20, 50];

    // styles to display the map
    var circleStyles = {
      heatmap : function(prop){
        return{
              'circle-radius' : {
                  'type': 'exponential',
                  'stops': [[2, 60], [6, 600]]
              },
              'circle-color': colorStyle(prop, tempRange),
              'circle-opacity': {
                  'property' : "" + prop,
                  'type': 'exponential',
                  'stops': [[-99, 0.0], [-50, 0.125]]
              },
              'circle-blur': 1
          };
      },
      solid : function(prop){
          return{
              'circle-radius': {
                    'type': 'exponential',
                    'stops': [[2, 5], [6, 20]]
                },
                'circle-opacity': {
                    'property' : "" + prop,
                    'type': 'exponential',
                    'stops': [[-99, 0.0], [-50, 1.0]]
                },
                'circle-color': colorStyle(prop, tempRange)
            };
      }
  }

    function updateMap(){
      var props = ['circle-color', 'circle-opacity'];
      updateStyle(currentMonth, props);
      changed();
    }

    function updateStyle(layer, props){
      var style = circleStyles[currentStyle](currentIndex);
      props.forEach(function(prop){
        if(prop in style){
          map.setPaintProperty(currentMonth, prop, style[prop]);
        }
      });
    }

    function loadStyle(){
        var props = ['circle-color', 'circle-opacity', 'circle-radius', 'circle-blur'];
        months.forEach(function(month){
          updateStyle(month, props);
        });
    }

    function updateYear(year){
      currentYear = year;
      currentIndex = currentYear - startYear;
      updateMap();
    }

    function updateMonth(month){
      var prevMonth = currentMonth;
      currentMonth = month;
      updateMap();  // want to update the map before we display the data
      showLayer(currentMonth);
      hideLayer(prevMonth);
    }

    function changed(){
      handlers.forEach(function(handler){
        handler();
      });
    }

    function hideLayer(month){
      myMap.setLayoutProperty(month, 'visibility', 'none');
    }

    function showLayer(month){
      myMap.setLayoutProperty(month, 'visibility', 'visible');
    }

    return {
      init: function(newMap, year, month, style){
          myMap = newMap;
          currentYear = year;
          currentStyle = style;
          currentMonth = month;
          loadStyle();
          showLayer(currentMonth);
          updateMap();
          changed();
      },
      setYear: function(year){
          updateYear(year);
      },
      setMonth: function(month){
          updateMonth(month);
      },
      setStyle: function(style){
          currentStyle = style;
          loadStyle();
          updateMap();
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
      getMonths : function(){
        return months;
      },
      onChange : function(handler){
        handlers.push(handler);
      }
    }
}();

mapboxgl.accessToken = 'pk.eyJ1IjoidGVvbWFuZGF2aWQiLCJhIjoiY2lwaHBrNnp4MDE2Z3RsbmpxeWVkbXhxMSJ9.rhKrjQ0Eb8iH0inNPQ7W8Q';

$(document).ready(function(){
  map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/teomandavid/ciqbmy8mh0001khmcg5jkce1l',
      zoom: 2,
      minZoom: 2,
      maxZoom: 7,
      center: [5.425411010332567, 51.22556912180988]
  });

  map.on('load', function () {
      climateData.init(map, 2000, 'january', 'solid');
  });

  // register update function w/tempdata
  $('#map-controls').slider({
    animate: 'fast',
    max: climateData.getYearRange()[1] - 1,
    min: climateData.getYearRange()[0],
    value: climateData.getCurrentYear(),
    slide: function(event, ui){
      $('#map-data').text("Year: " + ui.value);
    },
    stop: function(event, ui){
      climateData.setYear(ui.value);
    }
  });

  climateData.onChange(function(){
    $('#map-data').text("Year: " + climateData.getCurrentYear());


    $('#map-controls').slider("option", "value", climateData.getCurrentYear());
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
            intervalID = window.setInterval(climateData.iterate, 1000);
            $('#playpause').text("Stop! :-(");
            playing = true;
          }
      }
  }();

  $('#playpause').on('click', buttonHandler);

});
