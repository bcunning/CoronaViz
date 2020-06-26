import {HashString} from "./Utils.js";

export default class RegionPickerSection {
    constructor(name, regions) {
        this.name = name;
        this.regions = regions;
        this.ID = HashString(name);
    }
}