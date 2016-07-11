##### parse.py
##### Author: 		Teoman (Ted) Yavuzkurt
##### Email: 		teoman.david@gmail.com
##### Description: 	Parses climate data from the HadCRUT3 Record of Global Temperatures
#####				Converts raw data to GEOJson that can be used with MapBox and QGIS.

##### IMPORTS
import os, re, sys, time, geojson, argparse, subprocess

##### CONSTANTS -- move to init() func
START_YEAR = 1990 		# year to start ouputting data
END_YEAR = 2010			# year to end data output

VERBOSE = False			# print extra info to command line
PRETTY_PRINT = True		# make output pretty

PATH = "./climate-data"	# directory containing climate data set
OUTPATH = "./output/"	# directory to store output, will be created
OUTFILE = "climate-filter" 	# will append .json and times if needed
PRETTY_PRINT = True		# pretty print output

LIMIT = 25000			# maximum # of stations to parse (>6000 == all of them)
SPLIT_FILES = False		# output to single file or individual files by years
SPLIT_PERIOD = 10		# number of years per split
SPLIT_HEADERS = True	# separate headers from main file data
SPLIT_LAYERS = False		# separate output into different layers by starting year for data
SPLIT_POINTS = True

AVERAGE_TEMPS = True	# averages missing data points

MAX_MISSING = 10		# maximum # of missing observations before we drop an observation

##### REGEX -- precompiled for speed
# Matches fields we want to capture
reHeaders = re.compile("(Number|Name|Country|Lat|Long|Height|Start\syear|End\syear)=\s*(.*)")
# Matches numbers
reNum = re.compile("\-*\d+.*")
# Matches years
reYear = re.compile("(\d{4})\s+(.*)")
# Matches temperature readings
reTemp = re.compile("(\-*\d+.\d+)\s*(.*)")
# Matches the word "Obs:" (placed before temp readings)
reObs = re.compile("Obs:")
# Matches positive numbers (i.e. names of files) -- prevents matching DS_STORE etc
reInclude = re.compile("[0-9]+")

##### FUNCTIONS

# 	init():
#		Arguments: 		None
#		Description: 	Parses script arguments and starts parsing
#						Called on startup
def init():
	global LIMIT, SPLIT_FILES, VERBOSE, START_YEAR, END_YEAR, SPLIT_LAYERS, SPLIT_PERIOD
	parser = argparse.ArgumentParser(description='Parse climate data set into GEOJson.')
	parser.add_argument('-s', action="store_true", help='Split output into multiple files by year. Default: ' + str(SPLIT_FILES), default=SPLIT_FILES)
	parser.add_argument('-l', help='Max # of stations to process. (>6000 == all) Default: ' + str(LIMIT), type=int, nargs=1, default=[LIMIT])
	parser.add_argument('-v', action="store_true", help='Print extra info during parsing. Default: ' + str(VERBOSE), default=VERBOSE)
	parser.add_argument('-p', help="Period for output. Default: " + str(START_YEAR) + ", " + str(END_YEAR), type=int, nargs=2, default=[START_YEAR, END_YEAR])

	args = parser.parse_args()
	SPLIT_FILES = vars(args)['s']
	LIMIT = vars(args)['l'][0]
	VERBOSE = vars(args)['v']
	START_YEAR = vars(args)['p'][0]
	END_YEAR = vars(args)['p'][1]

	if(SPLIT_POINTS):
		SPLIT_LAYERS = True
		SPLIT_FILES = False
		SPLIT_PERIOD = 1

	parseData()

# 	parseData():
#		Arguments: 		None
#		Description: 	Calls other parsing functions
def parseData():
	yearRange = range(END_YEAR, START_YEAR, (SPLIT_PERIOD) * -1) if (SPLIT_FILES or SPLIT_LAYERS) else [None]
	stations = parseFiles()

	features = []
	for year in yearRange:
		period = [year - SPLIT_PERIOD, year] if year else None
		print("Converting interval " + str(period) + " to GEOJson")
		features.extend(stationsToFeatures(stations, period));
		if(SPLIT_FILES):
			outputJson(features, generateSuffix(period))
			features = []

	# if we've been accumulating the output to this point
	if(len(features) > 0):
		outputJson(features, generateSuffix())

	if(SPLIT_HEADERS):
		features = stationsToFeatures(stations, None, True)
		outputJson(features, generateSuffix(headersOnly = True))

def generateSuffix(period = None, headersOnly = False):
	if(period):
		suffix = str(period[0])
		if(period[0] != period[1]):
			suffix = suffix + "-" + str(period[1])
	else:
		suffix = "headers" if headersOnly else ""
	return suffix

def parseFiles():
	filenames = getAllFilenames()
	stations = []
	start = time.clock()

	for filename in filenames:
		station = parseFile(filename)
		if(station):
			stations.append(station)
			printv("PARSE COMPLETE, file: %s\t station %20s\t start %i\t end %i" % (filename[-6:], station['Name'], station['Start year'], station['End year']))
	print("%i files parsed in %i seconds" % (len(stations), time.clock()-start))
	return stations

def getAllFilenames():
	filenames = []
	count = 1
	for root, dirs, files in os.walk(PATH, topdown = False):
		for name in files:
			if reInclude.match(name):
				filenames.append(os.path.join(root, name))
				if count > LIMIT:
					break
				count = count + 1
		if count > LIMIT:
			break
	return filenames

def parseFile(filename):
	station = {}
	temperatures = []
	station['temperatures'] = temperatures
	file = open(filename)
	# are we capturing the actual data yet
	capturing = False
	for line in file:
		if reObs.match(line):
			capturing = True
			padTemperatures(station)
			continue
		if capturing:
			temperatures.extend(parseTemp(line))
		elif reHeaders.match(line):
			header = reHeaders.search(line)
			station[header.group(1)] = parseHeader(header.group(2))
	padTemperatures(station, True)
	return station if validStation(station) else []

# filter out bad station data
def validStation(station):
	return abs(station['Lat']) <= 90 and abs(station['Long']) <= 180

def parseHeader(string):
	return num(string) if reNum.match(string) else string.title()

def num(s):
    try:
        return int(s)
    except ValueError:
        return float(s)

def padTemperatures(station, padEnd = False):
	if(padEnd):
		finishYear = END_YEAR
		startYear = station['End year']
	else:
		finishYear = station['Start year']
		startYear = START_YEAR
	if(finishYear > startYear):
		for i in range(startYear, finishYear):
			for j in range(0, 12):
				station['temperatures'].append(-99.0);

def parseTemp(line):
	temps = []
	yearMatch = reYear.search(line)
	year = int(yearMatch.group(1))
	line = yearMatch.group(2)
	if year >= START_YEAR:
		for i in range(0, 12):
			temp = reTemp.search(line)
			temps.append(float(temp.group(1)))
			line = temp.group(2)
	return temps

def ifelse(ddict, key, default):
	return ddict[key] if key in ddict.keys() else default

def interpolate(temps, index):
	# verifies that the indices separated by rng are valid
	def valid(rng):
		return index - rng > 0 and \
			   index + rng < len(temps) and \
			   temps[index - rng] != -99 and \
			   temps[index + rng] != -99
	def avg(rng):
		return round((temps[index - rng] + temps[index + rng]) / 2, 1)

	# average first by surrounding months
	# if not possible, average by last year's reading and next year's
	if(valid(1) or valid(12)):
		return avg(1) if valid(1) else avg(12)
	else:
		return -99

def stationToGeojson(station, period, headersOnly = False):
	# negative Longitude in data is East, in MapBox it's West
	point = geojson.Point((-1 * station['Long'],station['Lat']))
	stationProperties = generateProperties(station, period, headersOnly)
	feature = geojson.Feature(geometry = point, properties=stationProperties) if 'exclude' not in stationProperties else None
	printv("FEATURE ENCODING COMPLETE, id: %s\t station: %20s\t" % (station['Number'], station['Name']))
	return feature

def generateProperties(station, period, headersOnly = False):
	properties = {} if (SPLIT_HEADERS and not headersOnly) else {
		"id" 		: 	ifelse(station, 'Number', time.clock()),
		"name" 		: 	ifelse(station, 'Name', ""),
		"country" 	: 	ifelse(station, 'Country', ""),
		"elevation"	:	ifelse(station, 'Height', 0.0),
		"start_year":	ifelse(station, 'Start year', START_YEAR),
		"end_year"	:	ifelse(station, 'End year', END_YEAR)
	}

	if(headersOnly):
		return properties

	properties['start'] = period[0]

	# set start and end points to go through temperatures array
	start = ((period[0] - START_YEAR)*12) if period else 0
	end = ((period[1] - START_YEAR)*12) if period else len(station['temperatures'])

	# quick fix come back later!
	if(SPLIT_POINTS):
		end = start + 1		# only getting one month per point

	missing = 0
	for i in range(start, end):
		# how many missing entries we tolerate
		tempstr = str(i - start) if not SPLIT_POINTS else "temp" # want it to be relative
		if(station['temperatures'][i] == -99):
			if(AVERAGE_TEMPS):
				station['temperatures'][i] = interpolate(station['temperatures'], i)

			# check if we were able to interpolate
			if(station['temperatures'][i] == -99):
				if(missing < MAX_MISSING):
					missing = missing + 1
				else:
					properties['exclude'] = True
					break

		properties[tempstr] = station['temperatures'][i]
	return properties

def stationsToFeatures(stations, period = None, headersOnly = False):
	features = []
	for station in stations:
		geoStation = stationToGeojson(station, period, headersOnly)
		# do not append if None returned (missing data point)
		if(geoStation):
			features.append(geoStation)
	return features

def outputJson(features, suffix = ""):
	print("OUTPUTING JSON DATA")

	geoData = geojson.FeatureCollection(features);

	filename = OUTPATH + OUTFILE + str(suffix) + ".json"
	os.makedirs(os.path.dirname(filename), exist_ok = True)

	extraArgs = {"indent":4, "separators":(',', ': ')} if PRETTY_PRINT else {}
	rawJson = geojson.dumps(geoData, sort_keys = True, **extraArgs)

	with open(filename, 'w') as outfile:
		outfile.write(rawJson)
	print("SUCCESSFULLY WROTE JSON FILE: " + filename)

# 	printv():
#		Arguments: 		Any number of string parameters
#		Description: 	Prints the arguments if VERBOSE is enabled
def printv(*args):
    if(VERBOSE):
        print(args)

init()
