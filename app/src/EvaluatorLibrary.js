import {format} from "d3-format";
import {select} from "d3-selection"

import MultiSeriesEvaluator from "./MultiSeriesEvaluator";
import Evaluator from "./Evaluator";
import {CASE_DATA_COLOR, DEATH_DATA_COLOR, PERCENT_POSITIVE_DATA_COLOR, PERCENT_POSITIVE_BENCHMARK_COLOR, TEST_DATA_COLOR, HOSPITALIZED_DATA_COLOR} from "./Evaluator";
import {RegionType} from "./Region";
import {AnnotationPlacement} from './OverTimeRenderer.js'
import OverTimeVisualization, {ChartDisplayMode} from "./OverTimeVisualization";
import {dateStringFromDate} from "./DateUtils";

const DEFAULT_TREND_LENGTH = 7;

const COVID_TRACKING_NAME = "The COVID Tracking Project";
const NYT_NAME = "The New York Times";

export default class EvaluatorLibrary {
    static baseLogHeatMapEvaluator(title, noun) {
        return new Evaluator(title, noun,
            function(evaluator, infectionSnapshot){
                return infectionSnapshot.infection.cases;
            },
            function (evaluator, infectionSnapshot){
                let value = evaluator.valueForSnapshot(infectionSnapshot);
                if (value == 0) {
                    return 0.0;
                }
                let appliedValue = Math.abs(value);
                let appliedLog = Math.max(Math.log10(appliedValue), 0); // We never want negative numbers here (happens if value is less than one)
                if (appliedLog == 0) {
                    return 0;
                }
                let result = (appliedLog + 0.1) / evaluator.maxPowerOfTen;
                if (value < 0) {
                    result *= -1;
                }
                return result;
            },
            function(evaluator, intensity) {
                let minAlpha = evaluator.minAlpha;
                let maxAlpha = evaluator.maxAlpha;
                let alpha = Math.min(Math.max(minAlpha + (maxAlpha - minAlpha) * Math.abs(intensity), 0), 1.0);

                let color = (intensity >= 0) ? evaluator.baseRGB : evaluator.baseNegativeRGB;

                return "rgba(" + color + "," + alpha.toString() + ")";
            });
    }

    static EvaluatorWithAnchor(evaluator, anchorNoun) {
        let result = Evaluator.from(evaluator);
        result.anchorNoun = anchorNoun;
        return result;
    }

    static regionNameEvaluator() {
        let result = new Evaluator("Region Name",
            "region",
            function(evaluator, snapshot) { return snapshot.region.name; },
            null,
            null);
        result.valueFormatter = function (value) {
            return value;
        }
        return result;
    }

    static confirmedCaseEvaluator() {
        let result = EvaluatorLibrary.baseLogHeatMapEvaluator("Confirmed cases", "cases");
        result.setBaseStat(function (evaluator, snapshot) { return snapshot.infection.cases; });
        result.baseRGB = CASE_DATA_COLOR;
        result.maxPowerOfTen = 5.0;
        result.supportedRegionLevel = RegionType.County;
        result.source = NYT_NAME;
        result.anchorNoun = "Cases";
        return result;
    }

    static currentlyHospitalizedDescription(measureDelta) {
        if (measureDelta) {
            return "The number of currently hospitalized people <Token:RegionPreposition> <Token:Region> <Token:ChangeVerbCurrent> <Token:DataQuantity> <Token:TimePreposition> <Token:ShortDate>. On average, net hospitalizations per day are <Token:DirectionalPercentChangeWeek> week over week, and <Token:DirectionalPercentChangeMonth> month over month.";
        }

        return "<Token:Region> <Token:ReportingVerb> <Token:DataQuantity> people currently hospitalized <Token:TimePreposition> </Token:TimePreposition> <Token:ShortDate>. On average, current hospitalizations are <Token:DirectionalPercentChangeWeek> week over week, and <Token:DirectionalPercentChangeMonth> month over month.";;
    }

    static currentlyHospitalizedEvaluator() {
        let result = EvaluatorLibrary.baseLogHeatMapEvaluator("Currently hospitalized", "currently hospitalized");
        result.setBaseStat(function (evaluator, snapshot) { return snapshot.infection.hospitalized; });
        result.filterFunction = function (evaluator, snapshot) {
            return (snapshot.infection.hospitalized.value > 0);
        };
        result.baseRGB = HOSPITALIZED_DATA_COLOR;
        result.nounWithNumber = "hospitalized";
        result.deltaAdjective = "Change in";
        result.maxPowerOfTen = 3.0;
        result.allowNegative = true;
        result.anchorNoun = "Hospitalized";
        result.source = COVID_TRACKING_NAME;
        result.descriptionTemplate = EvaluatorLibrary.currentlyHospitalizedDescription(false);
        result.toggleFunction = function(evaluator) { // Just return a simple copy, everything happens via toggleCount
            let result = Evaluator.from(evaluator);
            result.measureDelta = !evaluator.measureDelta;
            result.descriptionTemplate = EvaluatorLibrary.currentlyHospitalizedDescription(result.measureDelta);
            return result;
        };
        return result;
    }

    static totalTestEvaluator() {
        let result = EvaluatorLibrary.baseLogHeatMapEvaluator("Total tests", "tests");
        result.setBaseStat(function (evaluator, snapshot) { return snapshot.infection.totalTests; });
        result.filterFunction = function (evaluator, snapshot) {
            return (snapshot.infection.totalTests !== null);
        };
        result.baseRGB = TEST_DATA_COLOR;
        result.maxPowerOfTen = 7.0;
        result.upIsBetter = true;
        result.source = COVID_TRACKING_NAME;
        return result;
    }

    static testedPositiveEvaluator() {
        let result = EvaluatorLibrary.baseLogHeatMapEvaluator("Total positive results", "tests");
        result.setBaseStat(function (evaluator, snapshot) { return snapshot.infection.testedPositive; });
        result.filterFunction = function (evaluator, snapshot) {
            return (snapshot.infection.testedPositive !== null);
        };
        result.baseRGB = CASE_DATA_COLOR;
        result.maxPowerOfTen = 5.0;
        result.source = COVID_TRACKING_NAME;
        return result;
    }

    static testedNegativeEvaluator() {
        let result = EvaluatorLibrary.baseLogHeatMapEvaluator("Total negative results", "tests");
        result.setBaseStat(function (evaluator, snapshot) { return snapshot.infection.testedNegative});
        result.baseRGB = TEST_DATA_COLOR;
        result.maxPowerOfTen = 5.0;
        result.upIsBetter = true;
        result.source = COVID_TRACKING_NAME;
        return result;
    }

    static newTestEvaluator() {
        let result = EvaluatorLibrary.totalTestEvaluator();
        result.title = "New tests";
        result.measureDelta = true;
        return result;
    }

    static newTestPositiveEvaluator() {
        let result = EvaluatorLibrary.testedPositiveEvaluator();
        result.title = "New positive results";
        result.measureDelta = true;
        return result;
    }

    static newTestNegativeEvaluator() {
        let result = EvaluatorLibrary.testedNegativeEvaluator();
        result.title = "New negative results";
        result.measureDelta = true;
        return result;
    }

    static newTestBreakdownEvaluator() {
        let positiveEvaluator = EvaluatorLibrary.newTestPositiveEvaluator();
        let negativeEvaluator = EvaluatorLibrary.newTestNegativeEvaluator();
        let result = new MultiSeriesEvaluator([positiveEvaluator, negativeEvaluator], false);
        result.title = "New tests";
        result.noun = "tests";
        result.overallValueForSnapshot = MultiSeriesEvaluator.sumValueForSnapshot();
        result.upIsBetter = true;
        result.anchorNoun = "Tests";
        return result;
    }

    static newCaseBreakdownEvaluator() {
        let caseEvaluator = EvaluatorLibrary.newConfirmedCaseEvaluator();
        let deathEvaluator = EvaluatorLibrary.newDeathEvaluator();
        let result = new MultiSeriesEvaluator([deathEvaluator, caseEvaluator], false);
        result.title = "New cases";
        result.noun = "people";
        return result;
    }

    static totalTestBreakdownEvaluator() {
        let positiveEvaluator = EvaluatorLibrary.testedPositiveEvaluator();
        let negativeEvaluator = EvaluatorLibrary.testedNegativeEvaluator();
        let result = new MultiSeriesEvaluator([positiveEvaluator, negativeEvaluator], false);
        result.title = "Total tests";
        result.noun = "tests";
        result.overallValueForSnapshot = MultiSeriesEvaluator.sumValueForSnapshot();
        result.upIsBetter = true;
        return result;
    }

    static newTestPercentPositiveEvaluator(smoothed = false, needsBenchmark = false) {
        let positiveEvaluator = EvaluatorLibrary.newTestPositiveEvaluator();
        positiveEvaluator.cumulativeAdjective = "overall";
        positiveEvaluator.baseRGB = PERCENT_POSITIVE_DATA_COLOR;
        positiveEvaluator.deltaAdjective = "daily";
        positiveEvaluator.nounWithNumber = "positive";
        positiveEvaluator.needsGroupByCallback = function (evaluator) {
            return !evaluator.measureDelta;
        };
        // positiveEvaluator.filterFunction = function (evaluator, snapshot) {
        // 	return (snapshot.infection.totalTests.value > 0);
        // };

        let negativeEvaluator = EvaluatorLibrary.newTestNegativeEvaluator();
        negativeEvaluator.display = false;

        let result = new MultiSeriesEvaluator([positiveEvaluator, negativeEvaluator], false);
        result.title = "Positive rate"
        result.noun = "test positive rate";
        result.anchorNoun = "PositiveRate";
        result.normalized = true;
        result.overallValueForSnapshot = MultiSeriesEvaluator.quotientValueForSnapshot();
        result.valueFormatter = format(".1%");
        result.reportingVerbFormatter = function(evaluator) {
            return evaluator.measureDelta ? "came back positive" : "have come back positive";
        };
        result.descriptionTemplate = "<Token:TimePreposition> <Token:ShortDate>, <Token:DataQuantity> of <Token:CumulativeSignifier>COVID-19 tests <Token:RegionPreposition> <Token:Region> <Token:ReportingVerb>. On average, the <Token:FullyQualifiedNoun> has <Token:ChangeVerbWeek> <Token:AmountChangeWeek> when compared to last week, and <Token:ChangeVerbMonth> <Token:AmountChangeMonth> when compared to last month.";
        if (smoothed) {
            result = Evaluator.smoothedCopy(result);
        }
        if (needsBenchmark) {
            result.benchmarkEvaluator = EvaluatorLibrary.nationalNewTestPercentPositiveEvaluator();
            result.benchmarkRegionType = RegionType.Nation;
        }
        return result;
    }
    static nationalNewTestPercentPositiveEvaluator() {
        let result = EvaluatorLibrary.newTestPercentPositiveEvaluator(true, false);
        let displayedEvaluator = result.metricEvaluators[0];
        displayedEvaluator.metricEvaluators[0].title = "national new positive";
        displayedEvaluator.title = "National Positive Rate";
        displayedEvaluator.baseRGB = PERCENT_POSITIVE_BENCHMARK_COLOR;
        displayedEvaluator.wantsFill = false;
        displayedEvaluator.annotation = "<tspan x='0'>National</tspan><tspan x='0'dy='14'>average</tspan>"
        displayedEvaluator.annotationPlacement = AnnotationPlacement.AtDataMax;
        return result;
    }

    static newConfirmedCaseEvaluator() {
        let result = EvaluatorLibrary.confirmedCaseEvaluator();
        result.title = "New cases";
        result.measureDelta = true;
        return result;
    }

    static _newStatTrendEvaluator(metricEvaluator, numDays = DEFAULT_TREND_LENGTH, numDecimals = 0) {
        let result = Evaluator.from(metricEvaluator);
        result.setBaseStat(function (evaluator, snapshot) {
            let priorSnapshot = snapshot.timeSeries.snapshotPrecedingSnapshot(snapshot, numDays);
            if (priorSnapshot === null) {
                return 0;
            }

            let priorStat = metricEvaluator.baseStatForSnapshot(metricEvaluator, priorSnapshot);
            let currentStat = metricEvaluator.baseStatForSnapshot(metricEvaluator, snapshot);

            if (priorStat === null || currentStat === null) {
                return 0;
            }

            let dataIndex = Evaluator.dataIndexForParameters(metricEvaluator.measureDelta, true);
            let priorValue = priorStat.rawdata[dataIndex];
            let currentValue = currentStat.rawdata[dataIndex];
            if (priorValue === 0) {
                return 0;
            }
            let result = (currentValue / priorValue) - 1;
            return result;
        });
        result.source = metricEvaluator.source;
        result.title = numDays + "-day change";
        result.displayAsPercent = true;
        result.valueFormatter = function(value) {
            let absoluteValue = Math.abs(value);
            let base = format("." + numDecimals + "%")(absoluteValue);
            let sign = "";
            if (value > 0) {
                sign = "+ ";
            }
            if (value < 0) {
                sign = "- ";
            }
            return sign + base;
        };
        result.HTMLFormatter = function (evaluator, snapshot, value) {
            let text = evaluator.valueFormatter(value);
            if (value === 0) {
                return text;
            }
            let isBad = (value > 0);
            if (evaluator.upIsBetter) {
                isBad = !isBad;
            }
            let textRGB = isBad ? CASE_DATA_COLOR : TEST_DATA_COLOR;
            let html = "<span style='color:rgb(" + textRGB + ")'>" + text + "</span>";
            return html;
        }
        return result;
    }

    static dailyPercentPositiveTrendEvaluator(numDays = DEFAULT_TREND_LENGTH) {
        let result = EvaluatorLibrary._newStatTrendEvaluator(EvaluatorLibrary.newTestPositiveEvaluator(), numDays, 1);
        result.setBaseStat(function (evaluator, snapshot) {
            let priorSnapshot = snapshot.timeSeries.snapshotPrecedingSnapshot(snapshot, numDays);

            let dataIndex = Evaluator.dataIndexForParameters(true, true);

            let priorPositiveStat = priorSnapshot.infection.testedPositive;
            let priorTotalStat = priorSnapshot.infection.totalTests;

            if (priorPositiveStat === null || priorTotalStat === null) {
                return null;
            }

            let priorPositive = priorPositiveStat.rawdata[dataIndex];
            let priorTotal = priorTotalStat.rawdata[dataIndex];

            let currentPositive = snapshot.infection.testedPositive.rawdata[dataIndex];
            let currentTotal = snapshot.infection.totalTests.rawdata[dataIndex];

            let priorPercentPositive = (priorTotal === 0) ? 0 : priorPositive / priorTotal;
            let currentPercentPositive = (currentTotal === 0) ? 0 : currentPositive / currentTotal;

            let result = currentPercentPositive - priorPercentPositive;
            return result;
        });
        return result;
    }

    static dailyPercentPositiveGraphicEvaluator(dateRange = null) {
        return EvaluatorLibrary.graphicEvaluator(this.dailyPercentPositiveTrendEvaluator(), this.newTestPercentPositiveEvaluator(true), dateRange);
    }

    static newCaseTrendEvaluator(numDays = DEFAULT_TREND_LENGTH) {
        return EvaluatorLibrary._newStatTrendEvaluator(EvaluatorLibrary.newConfirmedCaseEvaluator(), numDays);
    }

    static graphicEvaluator(valueEvaluator, graphicEvaluator, dateRange = null) {
        let dateRangeStrings = null;
        if (dateRange !== null) {
            dateRangeStrings = dateRange.map(d => dateStringFromDate(d));
        }
        let result = Evaluator.from(valueEvaluator);
        result.title = "Trend";
        result.HTMLFormatter = function (evaluator, snapshot, value) {
            let temporaryParent = select('body').append("div").attr("class", "mini-chart-sizing");

            let chart = new OverTimeVisualization(temporaryParent, graphicEvaluator, ChartDisplayMode.Mini);
            let series = snapshot.timeSeries;
            if (dateRange !== null) {
                series = series.timeSeriesFrom(dateRangeStrings[0], dateRangeStrings[1]);
                chart.fixTimeDomain(dateRange[0], dateRange[1]);
            }

            let dataSlice = series.dataSliceForRegionID(snapshot.region.ID);
            chart.updateForData(dataSlice, false);
            let chartHTML = temporaryParent.node().innerHTML;
            temporaryParent.remove();
            return chartHTML;
        }
        return result;
    }

    static newCaseGraphicEvaluator(dateRange = null) {
        return this.graphicEvaluator(this.newCaseTrendEvaluator(), this.newConfirmedCaseEvaluator(), dateRange);
    }

    static newDeathTrendEvaluator(numDays = DEFAULT_TREND_LENGTH) {
        return EvaluatorLibrary._newStatTrendEvaluator(EvaluatorLibrary.newDeathEvaluator(), numDays);
    }

    static newDeathGraphicEvaluator(dateRange = null) {
        return this.graphicEvaluator(this.newDeathTrendEvaluator(), this.newDeathEvaluator(), dateRange);
    }

    static currentlyHospitalizedTrendEvaluator(numDays = DEFAULT_TREND_LENGTH) {
        return EvaluatorLibrary._newStatTrendEvaluator(EvaluatorLibrary.currentlyHospitalizedEvaluator(), numDays);
    }

    static currentlyHospitalizedGraphicEvaluator(dateRange = null) {
        return this.graphicEvaluator(this.currentlyHospitalizedTrendEvaluator(), this.currentlyHospitalizedEvaluator(), dateRange);
    }

    static newTestTrendEvaluator(numDays = DEFAULT_TREND_LENGTH) {
        let result = EvaluatorLibrary._newStatTrendEvaluator(EvaluatorLibrary.newTestEvaluator(), numDays);
        result.upIsBetter = true;
        return result;
    }

    static newTestGraphicEvaluator(dateRange = null) {
        return this.graphicEvaluator(this.newTestTrendEvaluator(), this.newTestEvaluator(), dateRange);
    }

    static newDeathEvaluator() {
        let result = EvaluatorLibrary.deathEvaluator();
        result.title = "New deaths";
        result.measureDelta = true;
        return result;
    }

    static deathEvaluator() {
        let result = EvaluatorLibrary.baseLogHeatMapEvaluator("Deaths", "deaths");
        result.setBaseStat(function (evaluator, snapshot) { return snapshot.infection.deaths; });
        result.baseRGB = DEATH_DATA_COLOR;
        result.maxPowerOfTen = 3.0;
        result.supportedRegionLevel = RegionType.County;
        result.source = NYT_NAME;
        result.anchorNoun = "Deaths";
        return result;
    }
}