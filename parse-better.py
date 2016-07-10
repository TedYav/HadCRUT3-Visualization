##### parse.py
##### Author: 		Teoman (Ted) Yavuzkurt
##### Email: 		teoman.david@gmail.com
##### Description: 	Parses climate data from the HadCRUT3 Record of Global Temperatures
#####				Converts raw data to GEOJson that can be used with MapBox and QGIS.

##### IMPORTS
import os, re, sys, time, geojson, argparse, subprocess

##### CONSTANTS -- move to init() func
START_YEAR = 1900 		# year to start ouputting data
END_YEAR = 2010			# year to end data output

VERBOSE = False			# print extra info to command line
PRETTY_PRINT = True		# make output pretty

PATH = "./climate-data"	# directory containing climate data set
OUTPATH = "./output-monthly/"	# directory to store output, will be created
OUTPREFIX = "" 	# will append .json and times if needed
OUTFILE = "climate"
PRETTY_PRINT = True		# pretty print output

LIMIT = 25000			# maximum # of stations to parse (>6000 == all of them)

AVERAGE_TEMPS = True	# averages missing data points

MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

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


# 	init():
#		Arguments: 		None
#		Description: 	Parses script arguments and starts parsing
#						Called on startup
def init():
	global LIMIT, VERBOSE, START_YEAR, END_YEAR
	parser = argparse.ArgumentParser(description='Parse climate data set into GEOJson.')
	parser.add_argument('-l', help='Max # of stations to process. (>6000 == all) Default: ' + str(LIMIT), type=int, nargs=1, default=[LIMIT])
	parser.add_argument('-v', action="store_true", help='Print extra info during parsing. Default: ' + str(VERBOSE), default=VERBOSE)
	parser.add_argument('-p', help="Period for output. Default: " + str(START_YEAR) + ", " + str(END_YEAR), type=int, nargs=2, default=[START_YEAR, END_YEAR])

	args = parser.parse_args()
	LIMIT = vars(args)['l'][0]
	VERBOSE = vars(args)['v']
	START_YEAR = vars(args)['p'][0]
	END_YEAR = vars(args)['p'][1]

	parseData()

# 	parseData():
#		Arguments: 		None
#		Description: 	Calls other parsing functions
def parseData():
	stations = parseFiles()

	for month in range(0, 12):
		print("Parsing month: " + MONTHS[month])
		features = stationsToFeatures(stations, month)
		outputJson(features, MONTHS[month])

	features = stationsToFeatures(stations, None, True)
	outputJson(features, "headers")
	writeTippecanoeCmd()

def writeTippecanoeCmd():
	command = "tippecanoe -o " + OUTPATH + OUTFILE + ".mbtiles"
	for month in MONTHS:
		command = command + " " + OUTPATH + OUTPREFIX + month + ".json"
	command = command + " " + OUTPATH + OUTPREFIX + "headers" + ".json"
	print("RUN THIS COMMAND IN TIPPECANOE\n %s" % command)

def stationToGeojson(station, month, headersOnly = False):
	# negative Longitude in data is East, in MapBox it's West
	point = geojson.Point((-1 * station['Long'],station['Lat']))
	stationProperties = generateProperties(station, month, headersOnly)
	feature = geojson.Feature(geometry = point, properties=stationProperties)
	printv("FEATURE ENCODING COMPLETE, id: %s\t station: %20s\t" % (station['Number'], station['Name']))
	return feature

def generateProperties(station, month, headersOnly = False):
	if(headersOnly):
		return {
			"id" 		: 	ifelse(station, 'Number', time.clock()),
			"name" 		: 	ifelse(station, 'Name', ""),
			"country" 	: 	ifelse(station, 'Country', ""),
			"elevation"	:	ifelse(station, 'Height', 0.0),
			"start_year":	ifelse(station, 'Start year', START_YEAR),
			"end_year"	:	ifelse(station, 'End year', END_YEAR)
		}

	properties = {}

	# month == offset
	for i in range(0, len(station['temperatures']), 12):
		tempIndex = i + month
		if(tempIndex > len(station['temperatures'])):
			break
		tempstr = str(i//12)
		if(station['temperatures'][tempIndex] == -99):
			if(AVERAGE_TEMPS):
				station['temperatures'][tempIndex] = interpolate(station['temperatures'], tempIndex)

		properties[tempstr] = station['temperatures'][tempIndex]
	return properties

def stationsToFeatures(stations, month, headersOnly = False):
	features = []
	for station in stations:
		geoStation = stationToGeojson(station, month, headersOnly)
		features.append(geoStation)
	return features

def outputJson(features, suffix = ""):
	print("OUTPUTING JSON DATA")

	geoData = geojson.FeatureCollection(features);

	filename = OUTPATH + OUTPREFIX + str(suffix) + ".json"
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
