import {format} from "d3-format";

import DataPoint from "./DataPoint.js";
import { HashString } from "./Utils.js";
import MultiSeriesEvaluator from "./MultiSeriesEvaluator.js";
import { RegionType } from "./Region";
import { StatIndex } from './DataPoint';
import { AnnotationPlacement } from './OverTimeRenderer.js'

export const CASE_DATA_COLOR = "203,25,29";
export const DEATH_DATA_COLOR = "47,42,45";
export const HOSPITALIZED_DATA_COLOR = "240,135,0";
export const TEST_DATA_COLOR = "38,120,144";
export const PERCENT_POSITIVE_DATA_COLOR = "137,42,98";
export const PERCENT_POSITIVE_BENCHMARK_COLOR = "201,79,150";

export default class Evaluator {
    constructor(title, noun, baseStatForSnapshot, intensityForSnapshot, colorForIntensity, measureDelta = false, smoothed = false, perCapita = false) {
        this.title = title;
        this.noun = noun;
        this.nounWithNumber = null;
        this.deltaAdjective = "new";
        this.cumulativeAdjective = "total";
        this.needsGroupByCallback = null;
        this.filterFunction = null;
        this.valueFormatter = null;
        this.HTMLFormatter = null;
        this.nounQualifier = null;
        this.reportingVerbFormatter = null;
        this.descriptionTemplate = Evaluator.baseDescriptionTemplate();
        this.upIsBetter = false;
        this.wantsFill = true;
        this.source = null;
        this.annotation = null;
        this.annotationPlacement = AnnotationPlacement.WeekAgo;
        this.supportedRegionLevel = RegionType.State;

        this.benchmarkEvaluator = null;
        this.benchmarkRegionType = RegionType.Nation;

        // Default toggle goes between measuring delta versus total count
        this.toggleFunction = function (evaluator) {
            let newMeasureBehavior = !evaluator.measureDelta;
            let newEvaluator = Evaluator.from(evaluator);
            newEvaluator.measureDelta = newMeasureBehavior;
            return newEvaluator;
        }
        this.statDescriptionFunction = function (evaluator) {
            return (evaluator.measureDelta ? evaluator.deltaAdjective : evaluator.cumulativeAdjective);
        }
        this.toggleCount = 0;

        this.measureDelta = measureDelta;
        this.smoothed = smoothed;
        this.perCapita = perCapita;
        this.normalized = false;
        this.allowNegative = false;
        this.displayAsPercent = false;
        this.display = true;

        this.baseStatForSnapshot = baseStatForSnapshot;
        this._intensityForSnapshot = intensityForSnapshot;
        this._colorForIntensity = colorForIntensity;

        this.baseRGB = "0, 0, 0";
        this.baseNegativeRGB = "0, 200, 0";
        this.maxPowerOfTen = 5.0;
        this.minAlpha = 0.15;
        this.maxAlpha = 1.0;
    }

    hashString() {
        return HashString(this.title);
    }

    equals(otherEvaluator) {
        return this.hashString() === otherEvaluator.hashString();
    }

    get metricEvaluators() {
        return [this];
    }

    statDescription() {
        return this.statDescriptionFunction(this);
    }

    smoothedNounSuffix() {
        let suffix = this.smoothed ? " (avg)" : "";
        return suffix;
    }

    formatValue(value) {
        let formatter = this._designatedValueFormatter();
        return formatter(value);
    }

    _designatedValueFormatter() {
        return (this.valueFormatter !== null) ? this.valueFormatter : format(",");
    }

    formatValueHTML(snapshot, value) {
        if (this.HTMLFormatter === null) {
            return this._designatedValueFormatter()(value);
        }
        return this.HTMLFormatter(this, snapshot, value);
    }

    graphedNoun(includeSuffix = true) {
        let base = this.noun;
        if (this.nounWithNumber !== null) {
            base = this.nounWithNumber;
        }
        let suffix = includeSuffix ? this.smoothedNounSuffix() : "";
        return base + suffix;
    }

    fullyQualifiedNoun() {
        if (this.nounQualifier !== null) {
            return this.nounQualifier(this);
        }

        return this.statDescription() + " " + this.noun;
    }

    reportingVerb() {
        if (this.reportingVerbFormatter !== null) {
            return this.reportingVerbFormatter(this);
        }

        return this.measureDelta ? "reported" : "has reported";
    }

    dataIsAtomic() {
        return !this.normalized && !this.displayAsPercent;
    }

    changeInGraphedNoun(treatAsAtomic = -1) {
        if (treatAsAtomic === -1) {
            treatAsAtomic = this.dataIsAtomic();
        }
        let base = this.graphedNoun(false);
        let deltaString = (this.measureDelta && treatAsAtomic) ? " / day" : "";
        let result = base + deltaString;
        return result;
    }

    needsGroupBy() {
        if (this.needsGroupByCallback === null) {
            return true;
        }

        return this.needsGroupByCallback(this);
    }

    toggledEvaluator() {
        this.toggleCount += 1;
        return this.toggleFunction(this);
    }

    static baseDescriptionTemplate() {
        return "<Token:Region> <Token:ReportingVerb> <Token:DataQuantity> <Token:Noun> <Token:TimePreposition> <Token:ShortDate>. On average, <Token:FullyQualifiedNoun> <Token:NounIs> <Token:DirectionalPercentChangeWeek> week over week, and <Token:DirectionalPercentChangeMonth> month over month.";
    }

    static from(otherEvaluator) {
        if (otherEvaluator.metricEvaluators.length > 1) {
            return MultiSeriesEvaluator.from(otherEvaluator);
        }

        let result =  new Evaluator(otherEvaluator.title,
            otherEvaluator.noun,
            otherEvaluator.baseStatForSnapshot,
            otherEvaluator._intensityForSnapshot,
            otherEvaluator._colorForIntensity,
            otherEvaluator.measureDelta,
            otherEvaluator.smoothed,
            otherEvaluator.perCapita);

        result.baseRGB = otherEvaluator.baseRGB;
        result.baseNegativeRGB = otherEvaluator.baseNegativeRGB;
        result.maxPowerOfTen = otherEvaluator.maxPowerOfTen;
        result.minAlpha = otherEvaluator.minAlpha;
        result.maxAlpha = otherEvaluator.maxAlpha;
        result.display = otherEvaluator.display;
        result.normalized = otherEvaluator.normalized;
        result.nounWithNumber = otherEvaluator.nounWithNumber;
        result.deltaAdjective = otherEvaluator.deltaAdjective;
        result.cumulativeAdjective = otherEvaluator.cumulativeAdjective;
        result.needsGroupByCallback = otherEvaluator.needsGroupByCallback;
        result.allowNegative = otherEvaluator.allowNegative;
        result.displayAsPercent = otherEvaluator.displayAsPercent;
        result.statDescriptionFunction = otherEvaluator.statDescriptionFunction;
        result.toggleFunction = otherEvaluator.toggleFunction;
        result.toggleCount = otherEvaluator.toggleCount;
        result.filterFunction = otherEvaluator.filterFunction;
        result.valueFormatter = otherEvaluator.valueFormatter;
        result.HTMLFormatter = otherEvaluator.HTMLFormatter;
        result.upIsBetter = otherEvaluator.upIsBetter;
        result.descriptionTemplate = otherEvaluator.descriptionTemplate;
        result.nounQualifier = otherEvaluator.nounQualifier;
        result.reportingVerbFormatter = otherEvaluator.reportingVerbFormatter;
        result.benchmarkEvaluator = otherEvaluator.benchmarkEvaluator;
        result.benchmarkRegionType = otherEvaluator.benchmarkRegionType;
        result.wantsFill = otherEvaluator.wantsFill;
        result.annotation = otherEvaluator.annotation;
        result.annotationPlacement = otherEvaluator.annotationPlacement;
        result.supportedRegionLevel = otherEvaluator.supportedRegionLevel;
        result.source = otherEvaluator.source;
        return result;
    }

    static smoothedCopy(otherEvaluator) {
        if (otherEvaluator.metricEvaluators.length > 1) {
            return MultiSeriesEvaluator.smoothedCopy(otherEvaluator);
        }

        let result = Evaluator.from(otherEvaluator);
        result.smoothed = true;
        return result;
    }

    statForSnapshot(snapshot) {
        let result = this.baseStatForSnapshot(this, snapshot);
        if (!(result instanceof DataPoint) && !(result instanceof Array)) {
            return result;
        }
        if (result.rawdata === undefined) {
            return null;
        }
        let dataIndex = Evaluator.dataIndexForParameters(this.measureDelta, this.smoothed);
        return result.rawdata[dataIndex];
    }

    static dataIndexForParameters(measureDelta, smoothed) {
        let dataIndex = StatIndex.Value;
        if (measureDelta) {
            dataIndex = DataPoint.ChangeIndexForIndex(dataIndex);
        }
        if (smoothed) {
            dataIndex = DataPoint.AverageIndexForIndex(dataIndex);
        }
        return dataIndex;
    }

    setBaseStat(baseStatFunction) {
        this.baseStatForSnapshot = baseStatFunction;
    }

    valueForSnapshot(infectionSnapshot) {
        if (infectionSnapshot === undefined) {
            debugger;
        }
        let result = this.statForSnapshot(infectionSnapshot);
        if (result === undefined || result == null) {
            return 0;
        }
        if (this.perCapita) {
            result = result / infectionSnapshot.region.population;
        }
        return result;
    }

    intensityForSnapshot(infectionSnapshot) {
        return this._intensityForSnapshot(this, infectionSnapshot);
    }

    colorForIntensity(intensity) {
        return this._colorForIntensity(this, intensity);
    }

    supportsRegionType(regionType) {
        return regionType <= this.supportedRegionLevel;
    }

    // Convenience method
    colorForSnapshot(infectionSnapshot) {
        return this.colorForIntensity(this.intensityForSnapshot(infectionSnapshot));
    }

    baseColor(alpha = 1.0) {
        return "rgba(" + this.baseRGB + "," + Math.min(Math.max(alpha, 0), 1.0) + ")";
    }
}