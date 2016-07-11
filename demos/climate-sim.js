

mapboxgl.accessToken = 'pk.eyJ1IjoidGVvbWFuZGF2aWQiLCJhIjoiY2lwaHBrNnp4MDE2Z3RsbmpxeWVkbXhxMSJ9.rhKrjQ0Eb8iH0inNPQ7W8Q';
var map;

const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const tempAnomaly = {1850:-0.431,1851:-0.020,1852:-0.320,1853:-0.388,1854:0.065,1855:-0.188,1856:-0.352,1857:-0.289,1858:-0.375,1859:-0.363,1860:-0.326,1861:-0.266,1862:-0.591,1863:-0.307,1864:-0.639,1865:-0.306,1866:-0.358,1867:-0.371,1868:-0.291,1869:-0.260,1870:-0.266,1871:-0.413,1872:-0.164,1873:-0.204,1874:-0.343,1875:-0.584,1876:-0.245,1877:-0.040,1878:0.109,1879:-0.409,1880:-0.169,1881:-0.303,1882:-0.138,1883:-0.412,1884:-0.541,1885:-0.500,1886:-0.423,1887:-0.522,1888:-0.488,1889:-0.228,1890:-0.467,1891:-0.599,1892:-0.603,1893:-0.689,1894:-0.551,1895:-0.551,1896:-0.380,1897:-0.301,1898:-0.405,1899:-0.330,1900:-0.176,1901:-0.187,1902:-0.352,1903:-0.435,1904:-0.570,1905:-0.434,1906:-0.224,1907:-0.619,1908:-0.493,1909:-0.471,1910:-0.346,1911:-0.469,1912:-0.392,1913:-0.326,1914:-0.063,1915:-0.082,1916:-0.370,1917:-0.694,1918:-0.489,1919:-0.277,1920:-0.306,1921:-0.168,1922:-0.261,1923:-0.295,1924:-0.370,1925:-0.280,1926:-0.046,1927:-0.231,1928:-0.164,1929:-0.444,1930:-0.137,1931:-0.125,1932:-0.056,1933:-0.296,1934:-0.071,1935:-0.167,1936:-0.111,1937:-0.071,1938:0.109,1939:-0.059,1940:-0.030,1941:-0.013,1942:-0.028,1943:-0.064,1944:0.073,1945:-0.100,1946:-0.078,1947:-0.009,1948:-0.059,1949:-0.150,1950:-0.318,1951:-0.125,1952:-0.037,1953:0.058,1954:-0.186,1955:-0.204,1956:-0.433,1957:-0.052,1958:0.081,1959:-0.011,1960:-0.100,1961:0.040,1962:-0.000,1963:0.007,1964:-0.285,1965:-0.185,1966:-0.116,1967:-0.120,1968:-0.210,1969:-0.059,1970:-0.022,1971:-0.205,1972:-0.176,1973:0.156,1974:-0.306,1975:-0.114,1976:-0.368,1977:0.072,1978:-0.046,1979:0.062,1980:0.141,1981:0.248,1982:0.021,1983:0.320,1984:-0.058,1985:-0.010,1986:0.117,1987:0.290,1988:0.342,1989:0.195,1990:0.428,1991:0.339,1992:0.103,1993:0.183,1994:0.326,1995:0.477,1996:0.215,1997:0.464,1998:0.821,1999:0.493,2000:0.363,2001:0.559,2002:0.666,2003:0.645,2004:0.622,2005:0.760,2006:0.674,2007:0.680,2008:0.527,2009:0.672}; 

const startYear = 1900;
const endYear = 2010;
const defaultStyle = 'solid';
const defaultStartYear = 2000;
const defaultStartMonth = months[0];

const animationSpeed = 1000;

const tempRange = [-20, 40];
const tempColors = [[0,0,255], [255,0,0]];

const anomalyRange = [-1, 1];
const anomalyColors = [[0,0,119], [255,97,0]];

var defaultWaterColor;  // loaded dynamically

var currentYear = defaultStartYear;
var currentMonth = defaultStartMonth;
var currentIndex = currentYear - startYear;
var currentStyle = defaultStyle;

// show anomaly data or not
var showAnomaly = false;

var intervalID;
var playing = false;
var loop = false;

var popup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false
});
var popupActive = false;
var currentFeature = null;

function convertColor(colorArray){ 
  return "rgb(" + colorArray[0] + "," + colorArray[1] + "," + colorArray[2] + ")"; 
}
function colorFromGradient(percent, gradient){ 
  return gradient[0].map(function(color, index){return Math.round((1-percent)*color + percent*gradient[1][index]);});
}
function initSelect(id, source, selected, handler){ source.forEach(function(item){ var option = $("<option></option>").attr("value",item).text(item); if(item == selected) {option.attr("selected", "selected");} $(id).append(option); }); $(id).on('change', function(){ handler(this.value); }); };

// styles to display the map
var circleStyles = {
  heatmap : function(prop){
    return{
          'circle-radius' : {
              'type': 'exponential',
              'stops': [[2, 60], [6, 600]]
          },
          'circle-color': {
              'property' : "" + prop,
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

var headerStyle = {
  'circle-radius' : circleStyles['solid'](0)['circle-radius'],
  'circle-opacity': 0
};

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

function updateMap(){
  currentIndex = currentYear - startYear;
  applyStyles([currentMonth], props = ['circle-color', 'circle-opacity']);
  updateAnomaly();
}

function applyStyles(layers = [currentMonth], props = null, style=circleStyles[currentStyle](currentIndex)){
  if(!props){ props = Object.keys(style);}
  props.forEach(function(prop){
    layers.forEach(function(layer){
      map.setPaintProperty(layer, prop, style[prop]);
    });
  });
}

$(document).ready(function(){
  
  map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/teomandavid/ciqgbmop7001bcfnnag7yupxd',
      zoom: 2,
      minZoom: 2,
      maxZoom: 7,
      center: [5.425411010332567, 51.22556912180988]
  });

  map.on('load', function () {
    defaultWaterColor = map.getPaintProperty('water', 'fill-color');
    applyStyles();
    
    // note: style this in studio!
    applyStyles(layers=['headers'], props=['circle-radius', 'circle-opacity'], headerStyle)
    map.setLayoutProperty('headers', 'visibility', 'visible');
    
    map.setLayoutProperty(currentMonth, 'visibility', 'visible');
    updateMap();

    // show page design elements
    $('#map-slider').slider({
      animate: 'fast',
      max: endYear - 1,
      min: startYear,
      value: currentYear,
      slide: function(event, ui){
        $('#year').text("Year: " + ui.value);
      },
      stop: function(event, ui){
        currentYear = ui.value;
        updateMap();
      }
    });

    initSelect('#map-months', months, currentMonth, handler = function(month){
      var prevMonth = currentMonth;
      currentMonth = month;
      map.setLayoutProperty(prevMonth, 'visibility', 'hidden');
      map.setLayoutProperty(currentMonth, 'visibility', 'visible');
      applyStyles();
    });

    initSelect('#map-display', Object.keys(circleStyles), currentStyle, handler = function(style){
      currentStyle = style;
      applyStyles(layers = months);
    });

    // set up popup handling

    function updatePopup(){
      if(popupActive){
        popup.setHTML(currentFeature['name'] + '<br /> ' + "Temperature: " + currentFeature['temperatures']["" + currentIndex]);
      }
    }

    map.on('mousemove', function(event) {
      if(currentStyle == 'heatmap') { popupActive = false; return popup.remove(); }
      
      var features = map.queryRenderedFeatures(event.point, {
            layers: ['headers', currentMonth]
      });

      if(!features.length || features.length == 1) { popupActive = false; return popup.remove(); }
        
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

      if(result['temperatures']["" + currentIndex] == -99) { popupActive = false; return popup.remove(); }

      popupActive = true;
      currentFeature = result;
      map.getCanvas().style.cursor = 'pointer';
      popup.setLngLat(result['coordinates'])
          .addTo(map);
      updatePopup();
    });

    map.on('render', function(){
      $('#year').text("Year: " + currentYear);
      $('#anomaly').text("Anomaly: " + tempAnomaly[currentYear]);
      $('#map-slider').slider("option", "value", currentYear);
      updatePopup();
    });

    $('#playpause').on('click', function(){
      if(playing) { 
        $('#playpause').text("Play");
        window.clearInterval(intervalID); 
      }else {  
        $('#playpause').text("Stop");
        intervalID = window.setInterval(function(){
          if(currentYear < endYear - 1){
            currentYear++;
          }else if(loop){
            currentYear = startYear;
          }
          updateMap();
        }, animationSpeed);
      }
      playing = !playing;
    });

    $('#toggleAnomaly').on('change', function(){
      showAnomaly = !showAnomaly;
      updateAnomaly(); 
    });

    $('#toggleLoop').on('change', function() { loop = !loop; });
  });
});