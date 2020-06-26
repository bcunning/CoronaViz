import DataPoint from "./DataPoint";

export const MobilityType = {
    RetailAndRecreation: 0,
    Workplace: 1,
    Transit: 2,
    Parks: 3,
    Residential: 4,
    NumTypes: 5,
};

export default class MobilityData {
    constructor() {
        this.retailAndRecreation = null;
        this.workplace = null;
        this.parks = null;
        this.transit = null;
        this.residential = null;
    }

    static fromJSONObject(data) {
        let result = new MobilityData();
        result.retailAndRecreation = DataPoint.fromJSONObject(data.rr);
        result.workplace = DataPoint.fromJSONObject(data.w);
        result.parks = DataPoint.fromJSONObject(data.p);
        result.transit = DataPoint.fromJSONObject(data.t);
        result.residential = DataPoint.fromJSONObject(data.res);
        return result;
    }
}