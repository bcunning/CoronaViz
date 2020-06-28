import DataPoint, {StatIndex} from "./DataPoint";

var infectionObjectPrototype = Object.prototype;
Object.defineProperty(infectionObjectPrototype, "cases", {
    get: function cases() {
        if (this.C === undefined || this.C.d === undefined) {
            return null;
        }
        return this.C.d;
    },
    set: function cases(newCases) {
        if (this.C === undefined) {
            this.C = new Object();
        }
        this.C.d = newCases;
    }
});

Object.defineProperty(infectionObjectPrototype, "deaths", {
    get: function deaths() {
        if (this.D === undefined || this.D.d === undefined) {
            return null;
        }
        return this.D.d;
    },
    set: function deaths(newCases) {
        if (this.D === undefined) {
            this.D = new Object();
        }
        this.D.d = newCases;
    }
});

Object.defineProperty(infectionObjectPrototype, "hospitalized", {
    get: function hospitalized() {
        if (this.H === undefined || this.H.d === undefined) {
            return null;
        }
        return this.H.d;
    },
    set: function hospitalized(newCases) {
        if (this.H === undefined) {
            this.H = new Object();
        }
        this.H.d = newCases;
    }
});

Object.defineProperty(infectionObjectPrototype, "totalTests", {
    get: function totalTests() {
        if (this.TT === undefined || this.TT.d === undefined) {
            return null;
        }
        return this.TT.d;
    },
    set: function totalTests(newCases) {
        if (this.TT === undefined) {
            this.TT = new Object();
        }
        this.TT.d = newCases;
    }
});

Object.defineProperty(infectionObjectPrototype, "testedNegative", {
    get: function testedNegative() {
        if (this.TN === undefined || this.TN.d === undefined) {
            return null;
        }
        return this.TN.d;
    },
    set: function testedNegative(newCases) {
        if (this.TN === undefined) {
            this.TN = new Object();
        }
        this.TN.d = newCases;
    }
});

Object.defineProperty(infectionObjectPrototype, "testedPositive", {
    get: function testedPositive() {
        if (this.TP === undefined || this.TP.d === undefined) {
            return null;
        }
        return this.TP.d;
    },
    set: function testedPositive(newCases) {
        if (this.TP === undefined) {
            this.TP = new Object();
        }
        this.TP.d = newCases;
    }
});

Object.defineProperty(infectionObjectPrototype, "percentPositive", {
    get: function percentPositive() {
        if (this.totalTests === null || this.totalTests.value === 0) {
            return "N/A";
        }
        let value = 100 * (this.testedPositive.value / this.totalTests.value);
        let roundedValue = Math.round(10 * value) / 10;
        return roundedValue + "%";
    },
    set: function percentPositive(newCases) {

    }
});


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
        return roundedValue + "%";
    }

    static NullInfection() {
        return new Infection(0, 0);
    }

    static fromJSONObject(data) {
        return data;
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