import MobilityData from "./MobilityData";

export default class MobilityTimeSeries {
    constructor() {
        this.dataByDay = new Map();
    }

    static fromJSONObject(object) {
        let result = new MobilityTimeSeries();
        result.dataByDay = this.dataByDayFromJSONObject(object.dataByDay);
        return result;
    }

    static dataByDayFromJSONObject(JSONObject) {
        let result = new Map();
        for (const dayString in JSONObject) {
            let daysMobilityJSON = JSONObject[dayString];
            let mobilityData = MobilityData.fromJSONObject(daysMobilityJSON);
            result.set(dayString, mobilityData)
        }
        // Sort by date strings
        result = new Map([...result.entries()].sort());
        return result;
    }

    days() {
        return Array.from(this.dataByDay.keys());
    }

    mobilityDataForDay(day) {
        return this.dataByDay.get(day);
    }
}