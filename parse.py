##### parse.py
##### Author: 		Teoman (Ted) Yavuzkurt
##### Email: 		teoman.david@gmail.com
##### Description: 	Parses climate data from the HadCRUT3 Record of Global Temperatures
#####				Converts raw data to GEOJson that can be used with MapBox and QGIS.

##### IMPORTS
import os, re, sys, time, geojson, argparse, subprocess

##### CONSTANTS -- move to init() func
START_YEAR = 2010 		# year to start ouputting data
END_YEAR = 2011			# year to end data output

VERBOSE = False			# print extra info to command line
PRETTY_PRINT = True		# make output pretty

PATH = "./climate-data"	# directory containing climate data set
OUTPATH = "./output/"	# directory to store output, will be created
OUTFILE = "climate" 	# will append .json and times if needed

LIMIT = 25000			# maximum # of stations to parse (>6000 == all of them)
SPLIT_OUTPUT = True		# output to single file or individual files containing one year

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
	global LIMIT, SPLIT_OUTPUT, VERBOSE
	parser = argparse.ArgumentParser(description='Parse climate data set into GEOJson.')
	parser.add_argument('-s', action="store_true", help='Split output into multiple files by year', default=SPLIT_OUTPUT)
	parser.add_argument('-l', help='Max # of stations to process. (default: all)', type=int, nargs=1, default=[LIMIT])
	parser.add_argument('-v', action="store_true", help='Print extra info during parsing', default=VERBOSE)

	args = parser.parse_args()
	SPLIT_OUTPUT = vars(args)['s']
	LIMIT = vars(args)['l'][0]
	VERBOSE = vars(args)['v']
	parseData()

# 	parseData():
#		Arguments: 		None
#		Description: 	Calls other parsing functions
def parseData():
	yearRange = range(START_YEAR, END_YEAR) if SPLIT_OUTPUT else [None]
	stations = parseFiles()
	for year in yearRange:
		stationsToGeojson(stations, year)

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

def stationToGeojson(station, year = None):
	# negative Longitude in data is East, in MapBox it's West
	point = geojson.Point((-1 * station['Long'],station['Lat']))
	stationProperties = generateProperties(station, year)
	feature = geojson.Feature(geometry = point, properties=stationProperties) if 'temperature' in stationProperties else None
	printv("FEATURE ENCODING COMPLETE, id: %s\t station: %20s\t" % (station['Number'], station['Name']))
	return feature

def generateProperties(station, year = None):
	properties = {
		"id" 		: 	ifelse(station, 'Number', time.clock()),
		"name" 		: 	ifelse(station, 'Name', ""),
		"country" 	: 	ifelse(station, 'Country', ""),
		"elevation"	:	ifelse(station, 'Height', 0.0),
		"start_year":	ifelse(station, 'Start year', START_YEAR),
		"end_year"	:	ifelse(station, 'End year', END_YEAR)
	}
	# set start and end points to go through temperatures array
	start = ((year - START_YEAR)*12) if year else 0
	end = ((year + 1 - START_YEAR)*12) if year else len(station['temperatures'])

	for i in range(start, end):
		tempstr = str(i - start) # want it to be relative
		tempstr = "temperature"
		# PROTIP --> leave out -99 entries
		if station['temperatures'][i] == -99: break
		properties[tempstr] = station['temperatures'][i]

		break
	return properties

def stationsToGeojson(stations, year = None):
	features = []
	for station in stations:
		geoStation = stationToGeojson(station, year)
		# do not append if None returned (missing data point)
		if(geoStation):
			features.append(geoStation)
	outputJson(geojson.FeatureCollection(features), year if year else "")

def outputJson(geoData, suffix = ""):
	print("OUTPUTING JSON DATA")
	filename = OUTPATH + OUTFILE + str(suffix) + ".json"
	os.makedirs(os.path.dirname(filename), exist_ok = True)

	rawJson = geojson.dumps(geoData, sort_keys = True)

	# if(PRETTY_PRINT):
	# 	result = subprocess.check_output(["python", "-m", "json.tool"], stdin=rawJson)
	# 	print(result)

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
