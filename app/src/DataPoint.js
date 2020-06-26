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

export default class DataPoint {
    constructor(value) {
        if (value === null) {
            return;
        }
        if (Number.isNaN(value) || value === undefined) {
            value = 0;
        }
        this.data = new Array(13).fill(0);
        this.value = value;
    }

    get value() {
        return this.data[DataPoint.FilterIndexToUsedIndices(StatIndex.Value)];
    }

    set value(newValue) {
        this.data[DataPoint.FilterIndexToUsedIndices(StatIndex.Value)] = newValue;
    }

    get change() {
        return this.data[DataPoint.FilterIndexToUsedIndices(StatIndex.Change)];
    }

    set change(newChange) {
        this.data[DataPoint.FilterIndexToUsedIndices(StatIndex.Change)] = newChange;
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
        if (JSONObject === undefined) {
            return null;
        }

        if (JSONObject.d !== undefined) {
            let result = new DataPoint(null);
            result.data = JSONObject.d;
            return result;
        }

        return new DataPoint();
    }
}