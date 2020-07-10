import Evaluator from "./Evaluator.js";
import {RegionType} from "./Region";
import {format} from "d3-format";

export default class MultiSeriesEvaluator {
    constructor(evaluators, normalize = true) {
        this.metricEvaluators = evaluators;
        this.normalized = normalize;
        this.smoothed = false;
        this.display = true;
        this.upIsBetter = false;
        this.overallValueForSnapshot = null;
        this.valueFormatter = null;
        this.nounQualifier = null;
        this.anchorNoun = null;
        this.reportingVerbFormatter = null;
        this.benchmarkEvaluator = null;
        this.benchmarkRegionType = RegionType.Nation;
        this.descriptionTemplate = Evaluator.baseDescriptionTemplate();
        this.supportedRegionLevel = RegionType.State;
    }

    hashString() {
        let result = "";
        this.metricEvaluators.forEach(function(e){
           result += e.hashString() + "-";
        });
        return result;
    }

    equals(otherEvaluator) {
        return this.hashString() === otherEvaluator.hashString();
    }
    
    formatValue(value) {
        let formatter = (this.valueFormatter !== null) ? this.valueFormatter : format(",.0f");
        return formatter(value);
    }

    formatValueHTML(snapshot, value) {
        return this.formatValue(value);
    }

    perCapitaNoun(fullyQualified = false) {
        return this.metricEvaluators[0].perCapitaNoun(fullyQualified);
    }

    numSeries() {
        return this.metricEvaluators.length;
    }

    statDescription() {
        return this.metricEvaluators[0].statDescription();
    }

    graphedNoun() {
        return this.metricEvaluators[0].graphedNoun();
    }

    changeInGraphedNoun() {
        return this.metricEvaluators[0].changeInGraphedNoun(!this.normalized);
    }

    needsGroupBy() {
        return this.metricEvaluators[0].needsGroupBy();
    }

    filterFunction() {
        return this.metricEvaluators[0].filterFunction;
    }

    dataIsAtomic() {
        return !this.normalized;
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

    valueForSnapshot(snapshot) {
        if (this.overallValueForSnapshot !== null) {
            return this.overallValueForSnapshot(this, snapshot);
        }

        return null;
    }

    get measureDelta() {
        return this.metricEvaluators[0].measureDelta;
    }

    set measureDelta(newMeasureDelta) {
        this.metricEvaluators.forEach(function (evaluator){
            evaluator.measureDelta = newMeasureDelta;
        });
    }

    get source() {
        return this.metricEvaluators[0].source;
    }

    set source(newSource) {
        this.metricEvaluators.forEach(function (evaluator){
            evaluator.source = newSource;
        });
    }

    get allowNegative() {
        return this.metricEvaluators[0].allowNegative;
    }

    set allowNegative(newAllowNegative) {
        this.metricEvaluators.forEach(function (evaluator){
            evaluator.allowNegative = newAllowNegative;
        });
    }

    toggledEvaluator() {
        let result = MultiSeriesEvaluator.from(this);
        result.metricEvaluators = this.metricEvaluators.map(e => e.toggledEvaluator());
        return result;
    }

    supportsRegionType(regionType) {
        return regionType <= this.supportedRegionLevel;
    }

    static movePropertiesFrom(source, destination) {
        destination.smoothed = source.smoothed;
        destination.title = source.title;
        destination.normalized = source.normalized;
        destination.noun = source.noun;
        destination.display = source.display;
        destination.overallValueForSnapshot = source.overallValueForSnapshot;
        destination.valueFormatter = source.valueFormatter;
        destination.upIsBetter = source.upIsBetter;
        destination.descriptionTemplate = source.descriptionTemplate;
        destination.nounQualifier = source.nounQualifier;
        destination.reportingVerbFormatter = source.reportingVerbFormatter;
        destination.benchmarkEvaluator = source.benchmarkEvaluator;
        destination.benchmarkRegionType = source.benchmarkRegionType;
        destination.supportedRegionLevel = source.supportedRegionLevel;
        destination.anchorNoun = source.anchorNoun;

        return destination;
    }

    static from(otherEvaluator) {
        let result = new MultiSeriesEvaluator(otherEvaluator.metricEvaluators.map(e => Evaluator.from(e)),
            otherEvaluator.normalized);
        this.movePropertiesFrom(otherEvaluator, result);
        return result;
    }

    static smoothedCopy(otherEvaluator) {
        let smoothedEvaluators = otherEvaluator.metricEvaluators.map(e => Evaluator.smoothedCopy(e));
        let result = new MultiSeriesEvaluator(smoothedEvaluators, otherEvaluator.normalized);
        this.movePropertiesFrom(otherEvaluator, result);
        result.smoothed = true;
        return result;
    }

    static quotientValueForSnapshot() {
        return function (evaluator, snapshot) {
            let sumFunction = MultiSeriesEvaluator.sumValueForSnapshot();
            let denominator = sumFunction(evaluator, snapshot);
            if (denominator === 0) {
                return 0;
            }

            let numeratorEvaluator = evaluator.metricEvaluators[0];
            let numerator = numeratorEvaluator.valueForSnapshot(snapshot);
            let result = (numerator / denominator);
            return result;
        };
    }

    static sumValueForSnapshot() {
        return function (evaluator, snapshot) {
            let result = 0;
            for (let i = 0; i < evaluator.metricEvaluators.length; i++) {
                let metricEvaluator = evaluator.metricEvaluators[i];
                result += metricEvaluator.valueForSnapshot(snapshot);
            }
            return result;
        };
    }
}