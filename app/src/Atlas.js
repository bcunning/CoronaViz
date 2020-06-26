import Region from './Region.js'

export default class Atlas {
    constructor() {
        this._regionsByID = new Map();
        this._regionIDAliases = new Map();
        this._aliasesByTargetID = new Map();
    }

    static fromJSONObject(JSONObject, parentAtlas) {
        let result = new Atlas();

        let regionTypeString = JSONObject.regionType;
        for (const regionID in JSONObject.regionsByID) {
            let newRegion = Region.fromJSONObject(JSONObject.regionsByID[regionID], regionTypeString, parentAtlas);
            result.registerRegion(newRegion);
        }
        for (const regionIDAlias in JSONObject.regionIDAliases) {
            let targetID = JSONObject.regionIDAliases[regionIDAlias];
            result.registerIDAlias(regionIDAlias, targetID);
        }

        return result;
    }

    registerRegion(region) {
        this._regionsByID.set(region.ID, region);
    }

    registerIDAlias(aliasID, targetID) {
        this._regionIDAliases.set(aliasID, targetID);

        let knownAliases = this._aliasesByTargetID.get(targetID);
        if (knownAliases === undefined) {
            knownAliases = [];
        }
        knownAliases.push(aliasID);
        this._aliasesByTargetID.set(targetID, knownAliases);
    }

    aliasesForRegion(regionID) {
        return this._aliasesByTargetID.get(regionID);
    }

    regionWithID(regionID) {
        let result = this._regionsByID.get(regionID);
        if (result === undefined && this._regionIDAliases.has(regionID)) {
            result = this.regionWithID(this._regionIDAliases.get(regionID));
        }
        return result;
    }

    has(regionID) {
        if (this._regionIDAliases.has(regionID)) {
            regionID = this._regionIDAliases.get(regionID);
        }
        return (this.regionWithID(regionID) !== undefined);
    }

    addAll(otherAtlas) {
        this._regionsByID = new Map([...this._regionsByID, ...otherAtlas._regionsByID]);
    }
}