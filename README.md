![Preview]("Logo Title Text 1")

# HadCRUT3 Climate Change Visualization

This is a visualization of the [HadCRUT3 Global Temperature Record](http://www.metoffice.gov.uk/research/climate/climate-monitoring/land-and-atmosphere/surface-station-records) provided by the [World Meteorological Organization](http://www.wmo.int/pages/index_en.html). This visualization shows both monthly average temperatures and global temperature anomalies (differences from long term mean) from 1850-2010. More than 3000 land temperature stations are visualized.

The visualization is powered by [Mapbox GL](https://www.mapbox.com/blog/mapbox-gl/)

## Motivation
A friend of mine started working at Mapbox recently and has been singing their praises. When I saw the HadCRUT3 data posted on Reddit(?) I thought it would be a great opportunity to experiment with the API. This was pretty fun to make and the visualization code (```climate-sim.js```) is **heavily** commented to explain how it works.

## Live Demo
[A live demo is available here.](http://www.evokeone.net/rprime/climate-sim.html)

## How it Works
The raw temperature data is contained in ```climate-data.tar.gz``` and was downloaded from the [UK Met Office](http://www.metoffice.gov.uk/research/climate/climate-monitoring/land-and-atmosphere/surface-station-records). I wrote a simple python script to parse these files (```parse.py```), turning them into [GeoJSON](http://geojson.org/) Feature Collections that could be uploaded to [Mapbox Studio](https://www.mapbox.com/studio/).

The parsing script generates 13 output files. Each output file contains all temperature data for a given month of the year, while one contains header information (name of station, elevation, country, etc).

I divided the data like this because placing all temperature data in one feature collection was too large for Mapbox Studio (and browsers) to display comfortably. Since we're concerned with seeing data trends, segmenting the data by month makes sense as this shows change over time rather than seasonal variations.

Within the GeoJSON collections, each station is represented by a point feature. It has properties numbered from ```0``` to ```160```, corresponding to obvserved temperature in 1850 until 2010. If a temperature observation is missing, the value is set to ```-99```, so that the visualization code knows to disregard it.

Once the data was processed, I uploaded all files to [Mapbox Studio](https://www.mapbox.com/studio/) and added them to a new style. Each file went on a different layer, which were placed below country labels / boundaries to prevent the visualization from obscuring the underlying map. 

All layers were initially set to be invisible so that I could enable / disable them programmatically.

I then exported this style and used it as the basis of the Visualization. The nice thing about this is that I don't have to add layers to the map manually--since they're in the style they will be automatically loaded, though they will be invisible at first.

The actual visualization code is stored in ```demos/climate-sim.js```. It's fairly straightforward and **thoroughly commented**, but I'll go through it here to explain things I learned along the way.

###Breakdown of `climate-sim.js`

####1. Constants
These aren't terribly interesting and are commented in the file if you want to change them. They tell the script when the data set starts, the colors to use, overall map style to use, etc. 

####2. Global State Variables
Next I declare some globals to store values like the current year for the visualization, the current selected temperature display style, whether the animation is playing or not, etc. Most of this is uninteresting and commented thoroughly, though one interesting tidbit is this:

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
I declare a few functions to calculate gradient colors and populate form fields with JQuery.

## Running/Modifying the Code
If you're interested in tinkering around with the visualization, first clone the repo:

```git clone https://github.com/TeomanDavid/HadCRUT3-Visualization && cd ./HadCRUT3-Visualization```

There are a few things you can do:

###Parse the Data Differently
The parsing script has a few options if you want to mess around on your own. If you just want to reparse the data using the parameters I did, then do the following (assuming you are in the repo directory):

```tar -zxvf ./climate-data.tar.gz && python3 parse.py```

The GeoJSON files will then be in the ```output``` directory.

You can also do the following:
####Parse Only a Subset

 * Parse only a subset
 * Disable interpolation
 * Output to different format
* **Recalculate Temperature Anomalies**
###Change the Map Style
If you want to fundamentally change the style of the map, the best way to do it will be in [Mapbox Studio](https://www.mapbox.com/studio/). You will have to run the parsing script again to reupload the data 
* **Change Visualization Colors or Display**