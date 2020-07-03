import Atlas from './Atlas.js'
import Infection from './Infection.js'
import InfectionSnapshot from "./InfectionSnapshot";
import MobilityTimeSeries from "./MobilityTimeSeries";
import EvaluatorLibrary from "./EvaluatorLibrary";
import {dateForTime, dateStringFromDate, MS_IN_DAY} from "./DateUtils";
import MobilityData from "./MobilityData";

export default class InfectionTimeSeries {
    constructor(infectionSnapshots) {
        this.regionAtlas = new Atlas();
        this.dataByDay = InfectionTimeSeries.aggregateTimeSeriesData(infectionSnapshots, this.regionAtlas);
        this._precedingDateCache = new Map();
    }

    static fromJSONObject(data, parentAtlas = null) {
        let result = new InfectionTimeSeries(null);
        result.regionAtlas = Atlas.fromJSONObject(data.regionAtlas, parentAtlas);
        result.dataByDay = InfectionTimeSeries.dataByDayFromJSONObject(data.dataByDay, result.regionAtlas, result);
        return result;
    }

    updateForMobilityJSON(mobilityJSON) {
        let thisTimeSeries = this;
        for (const regionID in mobilityJSON) {
            if (this.regionAtlas.has(regionID)) {
                let regionMobilityJSON = mobilityJSON[regionID].dataByDay;
                for (const dayString in regionMobilityJSON) {
                    let snapshot = thisTimeSeries.snapshotForDay(dayString, regionID);
                    if (snapshot !== null) {
                        snapshot.mobilityData = MobilityData.fromJSONObject(regionMobilityJSON[dayString]);
                    }
                }
            }
        }
    }

    containsRegion(regionID) {
        return this.regionAtlas.has(regionID);
    }

    containsRegionName(regionName) {
        return this.regionAtlas.hasRegionWithName(regionName);
    }

    regionForID(regionID) {
        return this.regionAtlas.regionWithID(regionID);
    }

    regionWithName(regionName) {
        return this.regionAtlas.regionWithName(regionName);
    }

    dayForPercentElapsed(percent) {
        let firstTime = this.firstDay.getTime();
        let lastTime = this.lastDay.getTime();
        let targetTime = firstTime + (lastTime - firstTime)*percent;

        let roundedTargetTime = Math.round(targetTime / MS_IN_DAY) * MS_IN_DAY;
        return this._dateStringForTime(roundedTargetTime);
    }

    lastDayString() {
        return this._dateStringForTime(this.lastDay.getTime());
    }

    snapshotPrecedingSnapshot(snapshot, numDays = 1) {
        // Date -> string crunching is expensive. Cache our date math accordingly
        let key = snapshot.dateString + "*" + numDays;
        let dateString = this._precedingDateCache.get(key);
        if (dateString === undefined) {
            let targetDate = snapshot.date.addDays(-numDays);
            dateString = dateStringFromDate(targetDate);
            this._precedingDateCache.set(key, dateString);
        }

        return this.snapshotForDay(dateString, snapshot.region.ID);
    }

    _dateStringForTime(unixTime) {
        let date = dateForTime(unixTime);
        return dateStringFromDate(date);
    }

    dataSliceForRegionID(regionID) {
        let result = [];
        this.dataByDay.forEach(function (regionIDToSnapshotMap) {
            let requestedSnapshot = regionIDToSnapshotMap.get(regionID);
            if (requestedSnapshot) {
                result.push(requestedSnapshot);
            }
        });
        return result;
    }

    timeSeriesFrom(beginDay, endDay) {
        let alteredData = new Map();
        this.dataByDay.forEach(function(regionIDToSnapshotMap, dateKey){
            let isAfterBeginDay = (beginDay === null) || (dateKey >= beginDay);
            let isBeforeEndDay = (endDay === null) || (dateKey <= endDay);
            if (isAfterBeginDay && isBeforeEndDay) {
                alteredData.set(dateKey, regionIDToSnapshotMap);
            }
        });

        let truncatedSeries = new InfectionTimeSeries();
        truncatedSeries.dataByDay = alteredData;
        truncatedSeries.regionAtlas = this.regionAtlas;
        return truncatedSeries;
    }

    topRegion() {
        let result = this.topRegions(1);
        return result[0];
    }

    topRegions(numRegions = 0,
               filter = null,
               evaluator = EvaluatorLibrary.confirmedCaseEvaluator(),
               descending = false,
               onDate = null) {
        let date = (onDate !== null) ? onDate : this.lastDay;
        let dateString = dateStringFromDate(date);
        let dataByRegion = this.dataForDay(dateString);
        if (dataByRegion === undefined) {
            return [];
        }
        let daysData = Array.from(dataByRegion.values());
        if (filter !== null) {
            daysData = daysData.filter(filter);
        }
        daysData.sort(function(snapshotA, snapshotB) {
            let valueB = evaluator.valueForSnapshot(snapshotB);
            let valueA = evaluator.valueForSnapshot(snapshotA);

            let result = 0;
            if (!Number.isNaN(parseFloat(valueB))) {
                result = (valueB - valueA);
            } else if ((typeof valueB) === "string") {
                result = valueB.localeCompare(valueA);
            }

            if (descending) {
                result *= -1;
            }
            return result;
        });

        if (daysData.length > numRegions && numRegions > 0) {
            daysData = daysData.slice(0, numRegions);
        }

        let justTheRegions = daysData.map(snapshot => snapshot.region);
        return justTheRegions;
    }

    timeSeriesBeginningAt(day) {
        return this.timeSeriesFrom(day, null);
    }

    timeSeriesEndingAt(day) {
        return this.timeSeriesFrom(null, day);
    }

    percentElapsedForDay(day) {
        let currentTime = new Date(day).getTime();
        let firstTime = this.firstDay.getTime();
        let lastTime = this.lastDay.getTime();

        return (currentTime - firstTime) / (lastTime - firstTime);
    }

    _didUpdateDataByDay() {
        let days = Array.from(this.days());
        days.sort((dateStringA, dateStringB) => dateStringA > dateStringB);

        if (days.length > 0) {
            this.firstDay = new Date(days[0]);
            this.lastDay = new Date(days[days.length - 1]);
        }
    }

    get dataByDay() {
        return this._dataByDay;
    }

    set dataByDay(newData) {
        this._dataByDay = newData;
        this._didUpdateDataByDay();
    }

    snapshotForDay(day, regionID) {
        let daysWorthOfData = this.dataForDay(day);
        if (daysWorthOfData === undefined) {
            return null;
        }
        let result = daysWorthOfData.get(regionID);
        if (result === undefined) {
            return null;
        }

        return result;
    }

    dataForDay(day, filterFunction = null) {
        let result = this._dataByDay.get(day);
        if (filterFunction !== null) {
            let filteredResult = new Map(result);
            filteredResult.forEach(function (infectionSnapshot, regionID) {
                if (!filterFunction(infectionSnapshot)) {
                    filteredResult.delete(regionID);
                }
            });
            result = filteredResult;
        }

        return result;
    }

    dataForRegionOnDay(regionID, day) {
        let targetRegion = this.regionAtlas.regionWithID(regionID);
        if (targetRegion === undefined) {
            return null;
        }
        let dataByRegionID = this.dataForDay(day);
        if (dataByRegionID === undefined) {
            return null;
        }
        return dataByRegionID.get(targetRegion.ID);
    }

    days() {
        return this._dataByDay.keys();
    }

    static dataByDayFromJSONObject(JSONObject, regionAtlas, timeSeries = null) {
        let result = new Map();
        for (const dayString in JSONObject) {
            let dataByRegionID = new Map();
            let JSONDataByRegionID = JSONObject[dayString];
            for (const regionID in JSONDataByRegionID) {
                let JSONSnapshot = JSONDataByRegionID[regionID];
                let infection = Infection.fromJSONObject(JSONSnapshot.i);
                let snapshot = new InfectionSnapshot(dayString, regionAtlas.regionWithID(regionID), infection, timeSeries);
                dataByRegionID.set(regionID, snapshot);
            }
            result.set(dayString, dataByRegionID);
        }
        // Sort by date strings
        result = new Map([...result.entries()].sort());
        return result;
    }

    static aggregateTimeSeriesData(infectionSnapshots, atlasToPopulate = null) {
        if (!infectionSnapshots) {
            return new Map();
        }

        let result = new Map();

        infectionSnapshots.forEach(function(infectionSnapshot) {
            // For each day of data, we create a map of (regionID -> infectionSnapshot)
            const timeKey = infectionSnapshot.dateString;
            let currentDaysData = result.get(timeKey);
            if (!currentDaysData) {
                currentDaysData = new Map();
            }

            if (atlasToPopulate != null) {
                atlasToPopulate.registerRegion(infectionSnapshot.region);
            }

            const regionID = infectionSnapshot.region.ID;
            currentDaysData.set(regionID, infectionSnapshot);
            result.set(timeKey, currentDaysData);
        });

        return result;
    }
}