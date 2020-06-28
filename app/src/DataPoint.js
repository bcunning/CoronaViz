export const StatIndex  = {
    Value: 0,
    Change: 1,
    Change_Change: 2,
    Change_RollingAverage: 3,
    Change_RateOfChange: 4,
    RollingAverage: 5,
    RollingAverage_Change: 6,
    RollingAverage_RollingAverage: 7,
    RollingAverage_RateOfChange: 8,
    RateOfChange: 9,
    RateOfChange_Change: 10,
    RateOfChange_RollingAverage: 11,
    RateOfChange_RateOfChange: 12
};

var arrayPrototype = Array.prototype;
Object.defineProperty(arrayPrototype, "rawdata", {
    get: function rawdata() {
        return this;
    },
    set: function rawdata(newData) {
        console.log("setting data");
    }
});
Object.defineProperty(arrayPrototype, "value", {
    get: function value() {
        return this[DataPoint.FilterIndexToUsedIndices(StatIndex.Value)];
    },
    set: function value(newValue) {
        this[DataPoint.FilterIndexToUsedIndices(StatIndex.Value)] = newValue;
    }
});
Object.defineProperty(arrayPrototype, "change", {
    get: function change() {
        return this[DataPoint.FilterIndexToUsedIndices(StatIndex.Change)];
    },
    set: function change(newChange) {
        this[DataPoint.FilterIndexToUsedIndices(StatIndex.Change)] = newChange;
    }
});

export default class DataPoint {
    constructor(value) {
        if (value === null) {
            return;
        }
        if (Number.isNaN(value) || value === undefined) {
            value = 0;
        }
        this.rawdata = new Array(13).fill(0);
        this.value = value;
    }

    get value() {
        return this.rawdata[DataPoint.FilterIndexToUsedIndices(StatIndex.Value)];
    }

    set value(newValue) {
        this.rawdata[DataPoint.FilterIndexToUsedIndices(StatIndex.Value)] = newValue;
    }

    get change() {
        return this.rawdata[DataPoint.FilterIndexToUsedIndices(StatIndex.Change)];
    }

    set change(newChange) {
        this.rawdata[DataPoint.FilterIndexToUsedIndices(StatIndex.Change)] = newChange;
    }

    static FilterIndexToUsedIndices(index) {
        switch (index) {
            case StatIndex.Value:
                return 0;
            case StatIndex.Change:
                return 1;
            case StatIndex.Change_RollingAverage:
                return 2;
            case StatIndex.RollingAverage:
                return 3;
        }

        return -1;
    }

    static ChangeIndexForIndex(index) {
        const changeOffset = 1;
        return this.FilterIndexToUsedIndices(index + changeOffset);
    }

    static AverageIndexForIndex(index) {
        const averageOffset = (index === StatIndex.Value) ? (StatIndex.RollingAverage - StatIndex.Value)
            : (StatIndex.Change_RollingAverage - StatIndex.Change);
        return this.FilterIndexToUsedIndices(index + averageOffset);
    }

    static fromJSONObject(JSONObject) {
        if (JSONObject === undefined || JSONObject.d === undefined) {
            return null;
        }

        // Shim an Array as a DataPoint class. Helps in speeding up core parsing routine.
        // Proxy methods for DataPoint getters and setters can be found at the top of this file in the Array prototype.
        return JSONObject.d;
    }
}