// climate-sim.js
// Main Javascript to display HADCrut3 Climate Data using MapboxGL.js

// AUTHOR: Teoman (Ted) Yavuzkurt
// www.github.com/teomandavid
// www.teomandavid.com

// Note: 
// This code has been refactored SIGNIFICANTLY to cut down on the number of functions and closures.
// This makes it easier to follow the flow of the code and to see the MapBoxGL API in use.
// However, this is not a very robust way to code (just putting everything in one script)
// Some "boring" functions (i.e. JQuery DOM, color etc stuff) are minified at the top. Use jsbeautifier.org
// if you want to see their code nicely.

// API access code to get the custom style for this project
mapboxgl.accessToken = 'pk.eyJ1IjoidGVvbWFuZGF2aWQiLCJhIjoiY2lwaHBrNnp4MDE2Z3RsbmpxeWVkbXhxMSJ9.rhKrjQ0Eb8iH0inNPQ7W8Q';

// need to declare this before using it, or JQuery will throw an error
var map;

// ###### CONSTANTS -- CONFIGURATION ######

// months and Temperature Anomaly data.
const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const tempAnomaly = {1850:-0.431,1851:-0.020,1852:-0.320,1853:-0.388,1854:0.065,1855:-0.188,1856:-0.352,1857:-0.289,1858:-0.375,1859:-0.363,1860:-0.326,1861:-0.266,1862:-0.591,1863:-0.307,1864:-0.639,1865:-0.306,1866:-0.358,1867:-0.371,1868:-0.291,1869:-0.260,1870:-0.266,1871:-0.413,1872:-0.164,1873:-0.204,1874:-0.343,1875:-0.584,1876:-0.245,1877:-0.040,1878:0.109,1879:-0.409,1880:-0.169,1881:-0.303,1882:-0.138,1883:-0.412,1884:-0.541,1885:-0.500,1886:-0.423,1887:-0.522,1888:-0.488,1889:-0.228,1890:-0.467,1891:-0.599,1892:-0.603,1893:-0.689,1894:-0.551,1895:-0.551,1896:-0.380,1897:-0.301,1898:-0.405,1899:-0.330,1900:-0.176,1901:-0.187,1902:-0.352,1903:-0.435,1904:-0.570,1905:-0.434,1906:-0.224,1907:-0.619,1908:-0.493,1909:-0.471,1910:-0.346,1911:-0.469,1912:-0.392,1913:-0.326,1914:-0.063,1915:-0.082,1916:-0.370,1917:-0.694,1918:-0.489,1919:-0.277,1920:-0.306,1921:-0.168,1922:-0.261,1923:-0.295,1924:-0.370,1925:-0.280,1926:-0.046,1927:-0.231,1928:-0.164,1929:-0.444,1930:-0.137,1931:-0.125,1932:-0.056,1933:-0.296,1934:-0.071,1935:-0.167,1936:-0.111,1937:-0.071,1938:0.109,1939:-0.059,1940:-0.030,1941:-0.013,1942:-0.028,1943:-0.064,1944:0.073,1945:-0.100,1946:-0.078,1947:-0.009,1948:-0.059,1949:-0.150,1950:-0.318,1951:-0.125,1952:-0.037,1953:0.058,1954:-0.186,1955:-0.204,1956:-0.433,1957:-0.052,1958:0.081,1959:-0.011,1960:-0.100,1961:0.040,1962:-0.000,1963:0.007,1964:-0.285,1965:-0.185,1966:-0.116,1967:-0.120,1968:-0.210,1969:-0.059,1970:-0.022,1971:-0.205,1972:-0.176,1973:0.156,1974:-0.306,1975:-0.114,1976:-0.368,1977:0.072,1978:-0.046,1979:0.062,1980:0.141,1981:0.248,1982:0.021,1983:0.320,1984:-0.058,1985:-0.010,1986:0.117,1987:0.290,1988:0.342,1989:0.195,1990:0.428,1991:0.339,1992:0.103,1993:0.183,1994:0.326,1995:0.477,1996:0.215,1997:0.464,1998:0.821,1999:0.493,2000:0.363,2001:0.559,2002:0.666,2003:0.645,2004:0.622,2005:0.760,2006:0.674,2007:0.680,2008:0.527,2009:0.672}; 

const dataStartYear = 1900;                     // year the data set starts, inclusive
const dataEndYear = 2010;                       // year the data set ends, not inclusive
const defaultStyle = 'solid';                   // default display mode for the map ('solid' or 'heatmap')
const defaultStartYear = 2000;                  // year to start the display
const defaultStartMonth = months[0];            // month to start the display
const animationSpeed = 1000;                    // how fast to change years in milliseconds
const tempRange = [-20, 40];                    // temperature range for raw temperatures
const tempColors = [[0,0,255], [255,0,0]];      // colors for Raw Temperature Gradient (color 1: [Red, Green, Blue] color2: [Red, Green, Blue])
const anomalyRange = [-1, 1];                   // temperature range for anomaly temperatures
const anomalyColors = [[0,0,119], [255,97,0]];  // colors for Anomaly Temp Gradient (color 1: [Red, Green, Blue] color2: [Red, Green, Blue]) 

const layerNames = months;                      // by default, our layers are just named after months

// NOTE: if you change the gradient colors here, you'll need to update them in climate-sim.css as well!

// ###### GLOBAL VARIABLES FOR SIMULATION #####

// simulation state
var currentYear = defaultStartYear;             // current year for simulation
var currentMonth = defaultStartMonth;           // current month for simulation
var currentIndex = currentYear - dataStartYear; // current position in temperatures array (i.e. year offset)
var currentStyle = defaultStyle;                // current simulation display style ('solid' or 'heatmap')

// display variables
var defaultWaterColor;                          // default color for water -- loaded dynamically from map on init
var showAnomaly = false;                        // display anomaly data or not

// animation variables
var intervalID;                                 // JavaScript intervalID for animation, so it can be cancelled
var playing = false;                            // animation playing or not
var loop = false;                               // loop animation

// popup variables
var popup = new mapboxgl.Popup({                // popup object
  closeButton: false,
  closeOnClick: false
});
var popupActive = false;                        // TRUE: popup is showing FALSE: popup hidden
var currentFeature = null;                      // current feature loaded in popup 

// ###### HELPER FUNCTIONS #####

// these functions are not terribly interesting as far as MapBoxGL goes, so I've minified their code here
// if you're curious about some JQuery go to jsbeautifier.org and paste these in
// converts color array [R,G,B] to string usable by MapBoxGL
function convertColor(colorArray){ return "rgb(" + colorArray[0] + "," + colorArray[1] + "," + colorArray[2] + ")"; }
// calculates color along a gradient, returns [R,G,B] array
function colorFromGradient(percent, gradient){ return gradient[0].map(function(color, index){return Math.round((1-percent)*color + percent*gradient[1][index]);}); }
// initializes select menus
function initSelect(id, source, selected, handler){ source.forEach(function(item){ var option = $("<option></option>").attr("value",item).text(item); if(item == selected) {option.attr("selected", "selected");} $(id).append(option); }); $(id).on('change', function(){ handler(this.value); }); }
// loads temperature scales
function loadTemperatureScales() {var elements = ['#raw-temp-start', '#raw-temp-end', '#anomaly-start', '#anomaly-end']; var temps = [tempRange[0], tempRange[1], anomalyRange[0], anomalyRange[1]]; elements.forEach(function(ele, index){ $(ele).html(temps[index] + "&deg;C"); }); }
// toggles animation when button is pushed
function toggleAnimation(){ if(playing) { $('#playpause').text("Play"); window.clearInterval(intervalID);}else { $('#playpause').text("Stop"); intervalID = window.setInterval(function(){ if(currentYear < dataEndYear - 1){ currentYear++; }else if(loop){ currentYear = dataStartYear;} updateMap(); }, animationSpeed); } playing = !playing;}

// ###### STYLES #####

// simulation display styles
// NOTE: each of these is a function
// This way we can pass in an argument (prop) which is the name
// of the property containing the values for the styling.
// e.g. styles['heatmap'](20);
var styles = {
  heatmap : function(prop){
    return{
          'circle-radius' : {
              'type': 'exponential',
              'stops': [[2, 60], [6, 600]]
          },
          'circle-color': {
              'property' : "" + prop,   // we have to do "" + prop to make it a string
              'type' : 'exponential',
              'stops' : [
                [tempRange[0], convertColor(tempColors[0])],
                [tempRange[1], convertColor(tempColors[1])]
              ]
          },
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
                'stops': [[2, 5], [6, 35]]
            },
            'circle-opacity': {
                'property' : "" + prop,
                'type': 'exponential',
                'stops': [[-99, 0.0], [-50, 1.0]]
            },
            'circle-color': {
              'property' : "" + prop,
              'type' : 'exponential',
              'stops' : [
                [tempRange[0], convertColor(tempColors[0])],
                [tempRange[1], convertColor(tempColors[1])]
              ]
          },
            'circle-blur': 0
        };
    }
};

// display style for the header layer
// uses circle-radius style from solid display style
// opacity set to 0 so we don't actually see it, but we can still
// interact with it
var headerStyle = {
  'circle-radius' : styles['solid'](0)['circle-radius'],
  'circle-opacity': 0
};

// ###### DISPLAY FUNCTIONS #####

// updateMap()
// recalculates currentIndex and updates circle-color and circle-opacity
// properties on the map. Redraws temperature anomaly if it's displayed.
function updateMap(){
  currentIndex = currentYear - dataStartYear;
  applyStyles([currentMonth], props = ['circle-color', 'circle-opacity']);
  if(showAnomaly){
    updateAnomaly();
  }
  updateHTML();
  updatePopup();
}


// updateAnomaly()
// redraws temperature anomaly data
// calculates what percentage along the temperature anomaly gradient
// the current temperature anomaly is. Then converts it to a color
// and finally renders on the map. If anomaly isn't showing, resets
// water color to default.
function updateAnomaly(){
  var color = defaultWaterColor;
  if(showAnomaly){
    var anomaly = tempAnomaly[currentYear];
    var percent = (anomaly - anomalyRange[0])/(anomalyRange[1] - anomalyRange[0]);
    percent = ((percent > 1)? 1 : ((percent < 0)?0 : percent));
    color = convertColor(colorFromGradient(percent, anomalyColors));
  }
  map.setPaintProperty('water', 'fill-color', color);
}


// updatePopup()
// a quick function to update the text in our popup
// it first checks that the popup is currently visible (popupActive == true)
// and then renders the HTML
// NOTE: you'd probably want to use a JQuery or other template here,
// but that would complicate this example
function updatePopup(){
  if(popupActive){
    popup.setHTML("<h4>" + currentFeature['name'] + '</h4><strong>' + "Temperature: </strong>" + currentFeature['temperatures']["" + currentIndex] + "&deg;C");
  }
}

// updateHTML()
// updates HTML elements to keep pace with map updates
function updateHTML(){
  $('#year').html(currentYear);
  $('#anomaly').html(tempAnomaly[currentYear] + "&deg;C");
  $('#map-slider').slider("option", "value", currentYear);
}

// applyStyles(layers, props, style)
// layers = layers to apply styles to (DEFAULT: current month's temperature)
// props  = properties to apply (DEFAULT: all properties specified by style...
                              //... set to null because style not loaded yet)
// style  = style to apply to layers (DEFAULT: current simulation display style)
// applies styles to layers automatically to avoid lots of repeated API calls
function applyStyles(layers = [currentMonth], props = null, style=styles[currentStyle](currentIndex)){
  if(!props){ props = Object.keys(style);}  // get all the properties from the style if we didn't specify which
  layers.forEach(function(layer){
    props.forEach(function(prop){
      // set the paint property on each layer
      map.setPaintProperty(layer, prop, style[prop]);
    });
  });
}

// using $(document).ready() ensures we don't try to render the map
// before the HTML page has completed loading. Otherwise we'll get errors.
$(document).ready(function(){
  
  // instantiate the map with some basic parameters that work well for this data set
  map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/teomandavid/ciqgbmop7001bcfnnag7yupxd',
      zoom: 2,
      minZoom: 2,
      maxZoom: 7,
      dragRotate: false, // don't allow rotation
      center: [5.425411010332567, 51.22556912180988]
  });

  // We let the map load, then configure it
  map.on('load', function () {

    // ###### LAYOUT AND DISPLAY ACTIONS ######

    // first we grab and store the current color of the water
    // using the getPaintProperty function
    // this will allow us to put it back later if we change it
    defaultWaterColor = map.getPaintProperty('water', 'fill-color');

    // once the map loads, we want to style all the layers
    // this will apply the current style to all temperature layers
    applyStyles(layers = layerNames);
    
    // we then apply our style to the header layer as well and make it "visible."
    // we could have done this in studio and programmatically changed it here
    // to match the 'solid' display style
    // NOTE: opacity for this is 0 because we don't want it to show -- just interact with mouse
    // if layer isn't visible it won't interact with mouse
    applyStyles(layers=['headers'], props=['circle-radius', 'circle-opacity'], headerStyle)
    map.setLayoutProperty('headers', 'visibility', 'visible');
    
    // show the current month
    map.setLayoutProperty(currentMonth, 'visibility', 'visible');

    // now let's draw the slider
    // this JQuery code is uninteresting but I've left it here to show how we update the map
    // we only change the map on the 'stop' event so that it can scroll smoothly
    // we don't use the 'change' event because this leads to an infinite loop if the map
    // updates the slider position (i.e. during iteration)
    $('#map-slider').slider({
      animate: 'fast',
      max: dataEndYear - 1,
      min: dataStartYear,
      value: currentYear,
      slide: function(event, ui){
        $('#year').html(ui.value);
        $('#anomaly').html(tempAnomaly[ui.value] + "&deg;C");
      },
      stop: function(event, ui){
        currentYear = ui.value;
        updateMap();
      }
    });

    // update HTML fields (including slider)
    // write year and such
    updateHTML();

    // initSelect function itself is not terribly interesting -- just populates select element
    // and registers a callback function (code at top if interested).
    // interesting part here is the callback -- we just swap layer visibility based
    // on what month is selected. 
    // We call updateMap() because the new layer is probably out of sync with the current year.
    initSelect('#map-months', months, currentMonth, handler = function(month){
      var prevMonth = currentMonth;
      currentMonth = month;
      map.setLayoutProperty(prevMonth, 'visibility', 'none');
      map.setLayoutProperty(currentMonth, 'visibility', 'visible');
      updateMap();
    });

    // if we change the style from 'heatmap' to 'solid' or vice versa
    // we set the current style, then apply it to all layers using applyStyles()
    initSelect('#map-display', Object.keys(styles), currentStyle, handler = function(style){
      currentStyle = style;
      applyStyles(layers = layerNames);
    });

    // boring JQuery function to display temperature scales
    // reads tempRange and anomalyRange and outputs HTML
    loadTemperatureScales();

    // ###### POPUP EVENT HANDLING ######

    // this function is a little long because there are a lot of cases in which we don't
    // want to display the popup. If any of these conditions are met we immediately set
    // popupActive to false (so it won't be updated and we don't waste cycles) and we 
    // remove the popup from the map.

    // any time the mouse moves over the map, we query features at that point
    // since the temperature layers do not contain header information, we have to grab
    // parts of our data from different layers. Thus we loop through all features at a point
    // and grab the respective information we need. The map SHOULD only trigger features at one
    // coordinate, thus we don't have to worry about getting the name for one climate station
    // and the temperature for another

    // finally, when we have the information, we display it
    map.on('mousemove', function(event) {
      // heatmap is too diffuse to display popups, so we return
      if(currentStyle == 'heatmap') { popupActive = false; return popup.remove(); }
      
      // query features at the mouse pointer location
      var features = map.queryRenderedFeatures(event.point, {
            layers: ['headers', currentMonth]
      });

      // if we didn't get any features or we only got 1 (i.e. not enough to get our data), return
      if(!features.length || features.length == 1) { popupActive = false; return popup.remove(); }
        
      // we loop through all the features we found and pull out the info we need
      var result = [];
      for(i in features){
        if('name' in features[i].properties){
          result['name'] = features[i].properties.name;
          result['coordinates'] = features[i].geometry.coordinates;
        }
        if(("" + currentIndex) in features[i].properties){
          result['temperatures'] = features[i].properties;
        }
      }

      // if the temperature is -99 at this point, it means the station has missing data
      // so we don't want to display a popup because there will not be a dot on the map. Return.
      // note again we have to use "" + currentIndex to access our temperature data because
      // the indices in GEOJSON features are all strings.
      if(result['temperatures']["" + currentIndex] == -99) { popupActive = false; return popup.remove(); }

      // if we've passed all of these checks, we are going to display the popup, so we set it active
      popupActive = true;

      // store the currentFeature so we can update temperature (if map is animated)
      // without querying again (slow)
      currentFeature = result;

      // change mouse cursor
      map.getCanvas().style.cursor = 'pointer';

      // display the popup
      popup.setLngLat(result['coordinates'])
          .addTo(map);
      updatePopup();
    });

    // ###### CONTROL EVENT HANDLING ######

    // most of this code is just JQuery code to update the display
    // we toggle the value of playing
    // and then set an animation interval and text accordingly
    // we call updateMap after each tick
    // code not terribly interesting so it's minified at above
    $('#playpause').on('click', toggleAnimation);

    // when we change the checkbox, toggle showAnomaly, and redraw
    $('#toggleAnomaly').on('change', function(){
      showAnomaly = !showAnomaly;
      updateAnomaly(); 
    });

    // when we change the checkbox, toggle loop
    // has no immediate effect unless animation is paused on last year
    $('#toggleLoop').on('change', function() { loop = !loop; });

    // and that's it! Not so bad :)
  });
});