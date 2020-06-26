export const RegionType  = {
    Nation: 0,
    Coalition: 1,
    State: 2,
    County: 3
};

export default class Region {
    constructor(name, ID, population, type) {
        // Base
        this.ID = ID;
        this.population = population;
        this.type = type;

        // Naming
        this.name = name;
        this.article = null; // "the" in some cases
        this.shortName = null;
        this.preposition = "in";
        this.plainEnglishNameFormatter = null;
        this.fullyQualifiedNameFormatter = null;

        // Hierarchy
        this.parentRegion = null; // State region for a county region, for example
        this.subregionIDs = null; // State regions for a coalition region, for example
    }

    fullyQualifiedName() {
        if (this.fullyQualifiedNameFormatter) {
            return this.fullyQualifiedNameFormatter(this.name, this.parentRegion);
        }

        return this.name;
    }

    plainEnglishName() {
        if (this.plainEnglishNameFormatter) {
            return this.plainEnglishNameFormatter(this.name, this.parentRegion);
        }

        return this.name;
    }

    articleString() {
        if (this.article === null) {
            return "";
        }
        return this.article + " ";
    }

    qualifiedNameWithArticle() {
        return this.articleString() + this.fullyQualifiedName();
    }

    plainEnglishNameWithArticle() {
        return this.articleString() + this.plainEnglishName();
    }

    prepositionString() {
        if (this.preposition === null) {
            return "";
        }

        return this.preposition + " ";
    }

    topParent() {
        let result = this.parentRegion;
        while (result.parentRegion !== null) {
            result = result.parentRegion;
        }
        return result;
    }

    static fromRegion(region) {
        let result = new Region(region.name, region.ID, region.population, region.type);

        result.article = region.article;
        result.shortName = region.shortName;
        result.preposition = region.preposition;
        result.plainEnglishNameFormatter = region.plainEnglishNameFormatter;
        result.fullyQualifiedNameFormatter = region.fullyQualifiedNameFormatter;

        result.parentRegion = region.parentRegion;
        result.subregionIDs = Array.from(region.subregionIDs);

        return result;
    }

    static metroCountyNames() {
        return new Set([ "New York City",
                                "Los Angeles",
                                "San Francisco",
                                "Philadelphia",
                                "Denver",
                                "San Diego",
                                "Dallas",
                                "East Baton Rouge",
                                "Sacramento",
                                "Alameda",
                                "San Bernardino" ]);
    }

    static fromJSONObject(object, regionTypeString, parentAtlas) {
        let regionType = Region.RegionTypeFromString(regionTypeString);
        let result = new Region(object.name, object.ID, object.population, regionType);

        if (object.preposition !== undefined) {
            result.preposition = object.preposition;
        }

        if (object.shortName !== undefined) {
            result.shortName = object.shortName;
        }

        if (object.parentRegionID !== undefined && parentAtlas !== null) {
            result.parentRegion = parentAtlas.regionWithID(object.parentRegionID);
        }

        if (object.subregionIDs !== undefined) {
            result.subregionIDs = Array.from(object.subregionIDs);
        }

        // Set up all the proper type-specific formatters here
        switch (regionType) {
            case RegionType.Nation:
                result.article = "the";
                result.fullyQualifiedNameFormatter = function(name, parentRegion) { return "United States"; };
                result.plainEnglishNameFormatter = function (name, parentRegion) { return "United States"; };
                break;
            case RegionType.Coalition:
                result.article = "the";
                break;
            case RegionType.State:
                break;
            case RegionType.County: {
                result.fullyQualifiedNameFormatter = function (name, parentRegion) {
                    let qualifier = " County, ";
                    if (Region.metroCountyNames().has(name)) {
                        qualifier = ", ";
                    }
                    return name + qualifier + parentRegion.shortName;
                };
                result.plainEnglishNameFormatter = function (name, parentRegion) {
                    let qualifier = " County";
                    if (Region.metroCountyNames().has(name)) {
                        qualifier = "";
                    }
                    return name + qualifier;
                };
                break;
            }
        }

        return result;
    }

    static RegionTypeFromString(regionTypeString) {
        switch (regionTypeString) {
            case "Nation":
                return RegionType.Nation;
            case "Coalition":
                return RegionType.Coalition;
            case "State":
                return RegionType.State;
            case "County":
                return RegionType.County;
        }

        return null;
    }
}