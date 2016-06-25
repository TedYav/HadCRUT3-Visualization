import os, re, sys, time, geojson

START_YEAR = 1980
END_YEAR = 2011

# print lots of info
VERBOSE = True

PATH = "./climate-data"
OUTFILE = "climate-omitted.json"
LIMIT = 25000

reHeaders = re.compile("(Number|Name|Country|Lat|Long|Height|Start\syear|End\syear)=\s*(.*)")
reNum = re.compile("\-*\d+.*")
reYear = re.compile("(\d{4})\s+(.*)")
reTemp = re.compile("(\-*\d+.\d+)\s*(.*)")
reObs = re.compile("Obs:")
reInclude = re.compile("[0-9]+")

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

def parseFiles():
	filenames = getAllFilenames()
	stations = []
	start = time.clock()
	
	for filename in filenames:
		station = parseFile(filename)
		if(station):
			stations.append(station)
			if(VERBOSE):
				print("PARSE COMPLETE, file: %s\t station %20s\t start %i\t end %i" % (filename[-6:], station['Name'], station['Start year'], station['End year']))
	print("%i files parsed in %i seconds" % (len(stations), time.clock()-start))
	return stations

def ifelse(ddict, key, default):
	return ddict[key] if key in ddict.keys() else default

def stationToGeojson(station):
	# negative Longitude in data is East, in MapBox it's West
	point = geojson.Point((-1 * station['Long'],station['Lat']))
	feature = geojson.Feature(geometry = point, properties=generateProperties(station));
	if(VERBOSE):
		print("FEATURE ENCODING COMPLETE, id: %s\t station: %20s\t" % (station['Number'], station['Name']))
	return feature

def generateProperties(station):
	properties = {
		"id" 		: 	ifelse(station, 'Number', time.clock()),
		"name" 		: 	ifelse(station, 'Name', ""),
		"country" 	: 	ifelse(station, 'Country', ""),
		"elevation"	:	ifelse(station, 'Height', 0.0),
		"start_year":	ifelse(station, 'Start year', START_YEAR),
		"end_year"	:	ifelse(station, 'End year', END_YEAR)
	}
	for i in range(0, len(station['temperatures'])):
		tempstr = str(i)
		# PROTIP --> leave out -99 entries
		if station['temperatures'] == -99: continue
		properties[tempstr] = station['temperatures'][i]
	return properties

def stationsToGeojson(stations):
	features = []
	for station in stations:
		features.append(stationToGeojson(station))
	return geojson.FeatureCollection(features)

def outputJson(geoData):
	print("OUTPUTING JSON DATA")
	outfile = open(OUTFILE, 'w')
	outfile.write(geojson.dumps(geoData, sort_keys = True))
	print("SUCCESSFULLY WROTE JSON FILE")

def parseData():
	stations = parseFiles()
	geoData = stationsToGeojson(stations)
	outputJson(geoData)

parseData()