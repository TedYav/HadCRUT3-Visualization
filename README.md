![Preview](https://raw.githubusercontent.com/TedYav/HadCRUT3-Visualization/master/preview.jpg "Preview")

# HadCRUT3 Climate Change Visualization
##### Ted Yavuzkurt ([TedY.io](http://www.tedy.io))

This is a visualization of the [HadCRUT3 Global Temperature Record](http://www.metoffice.gov.uk/research/climate/climate-monitoring/land-and-atmosphere/surface-station-records) provided by the [World Meteorological Organization](http://www.wmo.int/pages/index_en.html). This visualization shows both monthly average temperatures and global temperature anomalies (differences from long term mean) from 1850-2010. More than 3000 land temperature stations are visualized.

The visualization is powered by [Mapbox GL](https://www.mapbox.com/blog/mapbox-gl/)

## Motivation
A friend of mine started working at Mapbox recently and has been singing their praises. When I saw the HadCRUT3 data posted on Reddit(?) I thought it would be a great opportunity to experiment with the API. This was pretty fun to make and the visualization code (```climate-sim.js```) is **heavily** commented to explain how it works.

## Live Demo
[A live demo is available here.](https://tedyav.com/demos/climate-vis/)

## How it Works
The raw temperature data is contained in ```climate-data.tar.gz``` and was downloaded from the [UK Met Office](http://www.metoffice.gov.uk/research/climate/climate-monitoring/land-and-atmosphere/surface-station-records). I wrote a simple python script to parse these files (```parse.py```), turning them into [GeoJSON](http://geojson.org/) Feature Collections that could be uploaded to [Mapbox Studio](https://www.mapbox.com/studio/).

The parsing script generates 13 output files. Each output file contains all temperature data for a given month of the year, while one contains header information (name of station, elevation, country, etc).

I divided the data like this because placing all temperature data in one feature collection was too large for Mapbox Studio (and browsers) to display comfortably. Since we're concerned with seeing data trends, segmenting the data by month makes sense as this shows change over time rather than seasonal variations.

Within the GeoJSON collections, each station is represented by a point feature. It has properties numbered from ```0``` to ```160```, corresponding to obvserved temperature in 1850 until 2010. If a temperature observation is missing, the value is set to ```-99```, so that the visualization code knows to disregard it.

Once the data was processed, I uploaded all files to [Mapbox Studio](https://www.mapbox.com/studio/) and added them to a new style. Each file went on a different layer, which were placed below country labels / boundaries to prevent the visualization from obscuring the underlying map. 

All layers were initially set to be invisible so that I could enable / disable them programmatically.

I then exported this style and used it as the basis of the Visualization. The nice thing about this is that I don't have to add layers to the map manually--since they're in the style they will be automatically loaded, though they will be invisible at first.

The actual visualization code is stored in ```demos/climate-sim.js```. It's fairly straightforward and **thoroughly commented**, but I'll go through it here to explain things I learned along the way.

###Breakdown of the code

The main code for this is stored in `climate-sim.js`, but I'll go over the HTML first. Not going to go over the styles as I've never been strong with CSS.

####0. HTML File
The HTML for this is pretty simple:

```HTML
<!doctype html>
<html>
<head>
    <meta charset='utf-8' />
    <title>HadCRUT3 Climate Data</title>
    <meta name='viewport' content='initial-scale=1,maximum-scale=1,user-scalable=no' />

    <!-- stylesheets -->
    <link href='https://api.tiles.mapbox.com/mapbox-gl-js/v0.20.0/mapbox-gl.css' rel='stylesheet' />
    <link rel="stylesheet" href="https://code.jquery.com/ui/1.11.4/themes/cupertino/jquery-ui.css">
    <link rel="stylesheet" href="climate-sim.css" />

    <!-- scripts -->
    <script src='https://api.tiles.mapbox.com/mapbox-gl-js/v0.20.0/mapbox-gl.js'></script>
    <script   src="https://code.jquery.com/jquery-3.0.0.min.js"   integrity="sha256-JmvOoLtYsmqlsWxa7mDSLMwa6dZ9rrIdtrrVYRnDRH0="   crossorigin="anonymous"></script>
    <script src="https://code.jquery.com/ui/1.11.4/jquery-ui.min.js"></script>
    <script src="climate-sim.js"></script>
</head>
<body>

<main>
  <div id='map'></div>
</main>

<footer>
<div>
<div class="map-controls">
    <span class="map-text-title m2">Year: </span><span id="year" class="map-text m2"></span>
    <div id="map-slider" class="m2"></div>
    <select id="map-months" class="m2"></select>
    <select id="map-display" class="m2"></select>
    <span class="mini"> Anomaly: </span><input type="checkbox" id="toggle-anomaly" />
</div>

<div class="map-controls">
  <span class="map-text-title m5-top">Anomaly: </span><span id="anomaly" class="map-text m6-top"></span>
  <button id="playpause" class="m5">Play</button>
  <span class="mini m5">Loop:</span> <input type="checkbox" class="m8-top" id="toggle-loop" disabled>
  <div class="gradient-container"><span id="raw-temp-start"></span><div id="temp-gradient" class="gradient">Raw Temp</div><span id="raw-temp-end"></span></div>
  <div class="gradient-container"><span id="anomaly-start"></span><div id="anomaly-gradient" class="gradient">Anomaly</div><span id="anomaly-end"></span></div>
</div>
</div>

<div id="author-info">
<a href="#" id="info-button"><img src="info.png" width="32" height="32" /></a>
</div>
</footer>

</body>
</html>
```

We load a few scripts, create a div for our map, and then have some rows at the bottom for controls. That's it. The heavy lifting is in `climate-sim.js`.

####1. Constants
These aren't terribly interesting and are commented in the file if you want to change them. They tell the script when the data set starts, the colors to use, overall map style to use, etc. 

```javascript
mapboxgl.accessToken = 'pk.eyJ1IjoidGVvbWFuZGF2aWQiLCJhIjoiY2lwaHBrNnp4MDE2Z3RsbmpxeWVkbXhxMSJ9.rhKrjQ0Eb8iH0inNPQ7W8Q';
const mapStyle = 'mapbox://styles/teomandavid/ciqhsdrro002qcfnn41ofo4f2';

// need to declare this before using it, or JQuery will throw an error
var map;

const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const tempAnomaly = // redacted
const dataStartYear = 1850;                     // year the data set starts, inclusive
const dataEndYear = 2010;                       // year the data set ends, not inclusive
const defaultStyle = 'solid';                   // default display mode for the map ('solid' or 'heatmap')
const defaultStartYear = 2000;                  // year to start the display
const defaultStartMonth = months[0];            // month to start the display
const animationSpeed = 1000;                    // how fast to change years in milliseconds
const tempRange = [-20, 40];                    // temperature range for raw temperatures
const tempColors = [[0,0,255], [255,0,0]];      // colors for Raw Temperature Gradient (color 1: [Red, Green, Blue] color2: [Red, Green, Blue])
const anomalyRange = [-1, 1];                   // temperature range for anomaly temperatures
const anomalyColors = [[0,0,119], [255,97,0]];  // colors for Anomaly Temp Gradient (color 1: [Red, Green, Blue] color2: [Red, Green, Blue]) 
const layerNames = months;   
```

####2. Global State Variables
Next I declare some globals to store values like the current year for the visualization, the current selected temperature display style, whether the animation is playing or not, etc. 

```javascript
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
var loop = false;  
```

Most of this is uninteresting and commented thoroughly, though one interesting tidbit is this:

```javascript
var popup = new mapboxgl.Popup({                // popup object
  closeButton: false,
  closeOnClick: false
});
var popupActive = false;                        // TRUE: popup is showing FALSE: popup hidden
var currentFeature = null;                      // current feature loaded in popup 
```

If you've played with the live demo for the map, you'll notice the little information pop-up when you hover over a point. This is actually **a single popup object** that I simply move around. This is a better way to work with popups than creating one for each point and showing/hiding them.

####3. Helper Functions
I declare a few functions to calculate gradient colors and populate form fields with JQuery. Again, not terribly interesting.

```javascript
function convertColor(colorArray){ return "rgb(" + colorArray[0] + "," + colorArray[1] + "," + colorArray[2] + ")"; }
// calculates color along a gradient, returns [R,G,B] array
function colorFromGradient(percent, gradient){ return gradient[0].map(function(color, index){return Math.round((1-percent)*color + percent*gradient[1][index]);}); }
// initializes select menus
function initSelect(id, source, selected, handler){ source.forEach(function(item){ var option = $("<option></option>").attr("value",item).text(item); if(item == selected) {option.attr("selected", "selected");} $(id).append(option); }); $(id).on('change', function(){ handler(this.value); }); }
// loads temperature scales
function loadTemperatureScales() {var elements = ['#raw-temp-start', '#raw-temp-end', '#anomaly-start', '#anomaly-end']; var temps = [tempRange[0], tempRange[1], anomalyRange[0], anomalyRange[1]]; elements.forEach(function(ele, index){ $(ele).html(temps[index] + "&deg;C"); }); }
// toggles animation when button is pushed
function toggleAnimation(){ if(playing) { $('#toggle-loop').attr('disabled', true); $('#playpause').text("Play"); window.clearInterval(intervalID);}else { $('#toggle-loop').attr('disabled', false); $('#playpause').text("Stop"); intervalID = window.setInterval(function(){ if(currentYear < dataEndYear - 1){ currentYear++; }else if(loop){ currentYear = dataStartYear;}else{$('#playpause').click();} updateMap(); }, animationSpeed); } playing = !playing;}
// shows an alert w/author information
function showInfo(e){e.preventDefault(); alert("HADCrut3 Climate Simulation by Teoman (Ted) Yavuzkurt.\nhttp://www.github.com/TeomanDavid\nhttp://www.teomandavid.com\n\nSource available on GitHub under MIT license (my portions).\nRaw Data From: http://www.metoffice.gov.uk/research/climate/climate-monitoring/land-and-atmosphere/surface-station-records\n\nPOWERED BY MAPBOXGL: http://www.mapbox.com");}
```

####4. Temperature/Header Display Styles
This is where the code starts to get interesting. I searched for a long time about how to do a good temperature display using Mapbox GL, and I ultimately decided that trying to do a contour map would be too complicated. Instead, I opted to offer two distinct display methods: ```heatmap``` and ```solid```. These are stored in a global object called ```styles``` that contains two functions: ```heatmap``` and ```solid```.

I use functions instead of static styles *because I need to choose which property contains temperature data dynamically*. Thus, I can call ```styles['heatmap'](150)``` to get a heatmap temperature style corresponding to the 150th year of the visualization.

Here is the ```heatmap``` style

```javascript
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
```

All temperatures are displayed as circles with radii from 60 at base-zoom to 600 at max-zoom. This ensures they will be quite large and overlap. To create the heatmap effect, you'll notice ```circle-opacity``` is set to ```0.125```. This ensures that they will add and blend with each other (it is set to ```0.0``` at ```-99``` so that missing data points do not draw). Lastly, I set ```circle-blur``` to ```1``` so that they display in a very diffuse manner.

Continuing on, the ```solid``` style is a little more straightforward:

```javascript
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
```

Here we have no blur, and 100% opacity. This makes each circle small and discrete--ideal for showing the precise location of temperature stations.

Lastly, we have the style for our header layer:

```javascript
var headerStyle = {
  'circle-radius' : styles['solid'](0)['circle-radius'],
  'circle-opacity': 0
};
```

Interesting points here. First, I use the ```circle-radius``` property from the ```solid``` style. This means that I don't have to keep the code in sync if I change the radius of the ```solid``` style. Also, `circle-opacity` is set to ```0``` so that the header dots will trigger the popups to display without drawing on the map.

####5. Map Update Functions
I wrote a few functions to wrap map updates. **Note: the map has not been initialized at this point, but I'm writing this in terms of the layout of the file. We'll get to the creation of the map soon, I promise!**

Every time the map changes I call ```updateMap``` which simply updates the current temperature index and then applies new styles to the map.

```javascript
function updateMap(){
  currentIndex = currentYear - dataStartYear;
  applyStyles([currentMonth],['circle-color', 'circle-opacity']);
  if(showAnomaly){
    updateAnomaly();
  }
  updateHTML();
  updatePopup();
}
```

One thing to note is that it calls ```applyStyles```, which only updates the properties passed in. On a given map update, I only need to change the `circle-color` and `circle-opacity` properties, as blur and size do not change within a given display style. This speeds up redraws.

Here is the `applyStyles` function:

```javascript
function applyStyles(layers, props, style){
  if(style == null){ style = styles[currentStyle](currentIndex); }  // bug fix: safari and some browsers don't support default assignment in arguments
  if(props === "all"){ props = Object.keys(style);}  // get all the properties from the style if we didn't specify which
  layers.forEach(function(layer){
    props.forEach(function(prop){
      // set the paint property on each layer
      map.setPaintProperty(layer, prop, style[prop]);
    });
  });
}
```

This code would be simpler if ES6 default arguments were more commonly supported, but essentially I just iterate over the specified layers and apply the current style to all of them by calling ```map.setPaintProperty```. Writing this wrapper function allows me to change the style for all layers easily, by calling it with the global ```layerNames``` variable as the `layers` argument.

Next, I have the `updateAnomaly` function. This changes the color of the water on the map if the user has checked the anomaly checkbox.

```javascript
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
```

Pretty straightforward. I get the current temperature anomaly and calculate what percentage it is in the anomaly range I specified (in the constants). I then use some helper functions (`convertColor` and `colorFromGradient`) to calculate the color for this and draw it on the map.

Next, I have `updatePopup`. This just changes the popup's HTML content if the map is animating (so that the temperature updates). 

```javascript
function updatePopup(){
  if(popupActive){
    popup.setHTML("<h4>" + currentFeature['name'] + '</h4><strong>' + "Temperature: </strong>" + currentFeature['temperatures']["" + currentIndex] + "&deg;C");
  }
}
```

And finally, a helper function to keep all the HTML fields in the UI up to date:

```javascript
function updateHTML(){
  $('#year').html(currentYear);
  $('#anomaly').html(tempAnomaly[currentYear] + "&deg;C");
  $('#map-slider').slider("option", "value", currentYear);
}
```

####6. Drawing the Map
I make sure the document is ready:

`$(document).ready(function(){ ... }`

Create the map:

```javascript
 map = new mapboxgl.Map({
      container: 'map',
      style: mapStyle,
      zoom: 2,
      minZoom: 2,
      maxZoom: 7,
      dragRotate: false, // don't allow rotation
      center: [5.425411010332567, 51.22556912180988]
  });
```
  
Then wait for the map to load:
```
map.on('load', function () { ... }
```

Display our data and load some values:

```javascript
defaultWaterColor = map.getPaintProperty('water', 'fill-color');
applyStyles(layerNames, "all");
applyStyles(['headers'],['circle-radius', 'circle-opacity'], headerStyle)
map.setLayoutProperty('headers', 'visibility', 'visible');
map.setLayoutProperty(currentMonth, 'visibility', 'visible');
```
I store the water color so it can be restored (this decouples the code from the specified style). I apply the current style to all layers, and then set the current layers as visible so they can interact with the mouse.

Next I create the slider using JQuery:

```javascript
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
   updateHTML();
```
Important thing to note here: I do not update the map as the slider is moving--only when it stops. This makes it faster.

Next I initialize the months selection menu and set an event handler on change (using my `initSelect` helper function):

```javascript
initSelect('#map-months', months, currentMonth, handler = function(month){
      var prevMonth = currentMonth;
      currentMonth = month;
      map.setLayoutProperty(prevMonth, 'visibility', 'none');
      map.setLayoutProperty(currentMonth, 'visibility', 'visible');
      updateMap();
    });
```

Important point to note here is that to change months, I simply hide the current layer and show the layer corresponding to the month I want. This creates a break in continuity to change layers, but it ensures that animations within a layer (showing temperature trends) are smooth.

Next, I initialize the styles selector similarly:

```javascript
initSelect('#map-display', Object.keys(styles), currentStyle, handler = function(style){
      currentStyle = style;
      applyStyles(layerNames, "all");
    });
```
Here I use the `applyStyles` helper to reapply the new style to all layers.

Next major order of business is setting up event handling for the popups:
```javascript
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

```

I've left the comments in here to explain what it's doing. Main thing to note is that we don't display the popup if we're in heatmap mode (as this wouldn't make sense--how would you know which station you're over?) and that we only display the popup by calling `popup.setLngLat(result['coordinates'])` if we've passed all the checks. If we fail any check (ensuring that the station has data at this time, ensuring that we're in the right mode, etc) we remove the popup by calling `popup.remove()`. 

Also note that since the header layer and the temperature layer are different, we must query two layers as follows:

```javascript
var features = map.queryRenderedFeatures(event.point, {
            layers: ['headers', currentMonth]
      });
```

and then load the data out of them using a bit of clever logic:

```javascript
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
```

This adds complexity, but keeps the map size smaller. Adding header data to every temperature layer would be wasteful.

Lastly, I set up event handlers for the other controls:

```javascript
$('#playpause').on('click', toggleAnimation);
$('#toggle-anomaly').on('change', function(){
  showAnomaly = !showAnomaly;
  updateAnomaly(); 
});
$('#toggle-loop').on('change', function() { loop = !loop; });
$('#info-button').on('click', showInfo);
```

That's all there is to it! Seems like a lot going on, but it's basically pretty simple. Just a few wrapper functions to update the proper layers. We just translate a given year to a temperature index, and then tell Mapbox GL to render the map color based on that temperature index.

## Running/Modifying the Code
If you're interested in tinkering around with the visualization, first clone the repo:

```git clone https://github.com/TedYav/HadCRUT3-Visualization && cd ./HadCRUT3-Visualization```

There are a few things you can do:

###Parse the Data Differently
The parsing script has a few options if you want to mess around on your own. If you just want to reparse the data using the parameters I did, then do the following (assuming you are in the repo directory):

```tar -zxvf ./climate-data.tar.gz && python3 parse.py```

The GeoJSON files will then be in the ```output``` directory.

I've written a few different options to output the data. If you want to see them run:

```python3 parse.py --help```

####Recalculate Temperature Anomalies####
There is a script [available here that will calculate temperature anomalies](http://www.metoffice.gov.uk/media/zip/8/k/gridding_and_averaging_code.zip). If you want to run it yourself quickly, run the following command:

```
mkdir anomaly && cd ./anomaly && curl http://www.metoffice.gov.uk/media/zip/e/0/station_files.20110720.zip > station_files.zip && unzip -x station_files.zip -d ./station_files && curl http://www.metoffice.gov.uk/media/zip/8/k/gridding_and_averaging_code.zip > grid.zip && unzip -x grid.zip && perl station_gridder.perl | perl make_global_average_ts_ascii.perl > anomaly.txt
```

Anomaly data is currently stored directly in `climate-sim.js`.

###Change the Map Style
If you want to fundamentally change the style of the map, the best way to do it will be in [Mapbox Studio](https://www.mapbox.com/studio/). You will have to run the parsing script again to reupload the data.

[Here is the original style I made](https://api.mapbox.com/styles/v1/teomandavid/ciqhsdrro002qcfnn41ofo4f2.html?title=true&access_token=pk.eyJ1IjoidGVvbWFuZGF2aWQiLCJhIjoiY2lwaHBrNnp4MDE2Z3RsbmpxeWVkbXhxMSJ9.rhKrjQ0Eb8iH0inNPQ7W8Q#2.0001085731437036/36.39815027614806/-12.706191133281237/0) in case you want to see it by itself and edit it.

Make sure you set your layer names to lowercase months (i.e. 'january'), or set the names accordingly in `layerNames` in `climate-sim.js`.

###Change Visualization Colors or Display###
The best way to do this is to edit `climate-sim.js`. There are a set of constants at the top of the file that control most display options. If you want to dig in further, edit the code and have fun!
