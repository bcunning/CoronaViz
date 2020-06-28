import DataPoint from "./DataPoint";

export default class Infection {
    constructor(cases, deaths) {
        if (cases === null && deaths === null) {
            return;
        }
        this.cases = new DataPoint(parseInt(cases));
        this.deaths = new DataPoint(parseInt(deaths));
        this.hospitalized = new DataPoint(0);
        this.ventilated = null;
        this.totalTests = new DataPoint(0);
        this.testedNegative = new DataPoint(0);
        this.testedPositive = new DataPoint(0);
    }

    percentPositive() {
        if (this.totalTests === null || this.totalTests.value === 0) {
            return "N/A";
        }
        let value = 100 * (this.testedPositive.value / this.totalTests.value);
        let roundedValue = Math.round(10 * value) / 10;
        let result = roundedValue + "%";
        return result;
    }

    static NullInfection() {
        return new Infection(0, 0);
    }

    static fromJSONObject(data) {
        let result = new Infection(null, null);
        result.cases = DataPoint.fromJSONObject(data.C);
        result.deaths = DataPoint.fromJSONObject(data.D);
        result.hospitalized = DataPoint.fromJSONObject(data.H);
        result.totalTests = DataPoint.fromJSONObject(data.TT);
        result.testedNegative = DataPoint.fromJSONObject(data.TN);
        result.testedPositive = DataPoint.fromJSONObject(data.TP);
        return result;
    }
}