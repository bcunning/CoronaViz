import {normalizeDate} from "./DateUtils";

const __dateStringCache = new Map();

export default class InfectionSnapshot {
    constructor(dateString, region, infection, timeSeries = null) {
        this.dateString = dateString;
        this.date = InfectionSnapshot.dateForString(dateString);
        this.region = region;
        this.infection = infection;
        this.mobilityData = null;
        this.timeSeries = timeSeries;
    }

    monthString() {
        return this.dateString.split("-")[1];
    }

    yearString() {
        return this.dateString.split("-")[0];
    }

    normalizedDate() {
        return normalizeDate(this.date);
    }

    dateOnlyDiffersInDay(otherSnapshot) {
        return (this.monthString() === otherSnapshot.monthString()) && (this.yearString() === otherSnapshot.yearString());
    }

    static dateForString(dateString) {
        let result = __dateStringCache.get(dateString);
        if (result === undefined) {
            result = new Date(dateString);
            __dateStringCache.set(dateString, result);
        }
        return result;
    }
}