import { stack, stackOffsetExpand } from 'd3-shape';
import { max, min } from 'd3-array';

import ChartDescription from "./ChartDescription.js";
import ChartTitle from "./ChartTitle.js";
import Evaluator from "./Evaluator.js";
import HoverManager from './HoverManager.js';

import OverTimeRenderer from "./OverTimeRenderer";
import OverTimeSeries from "./OverTimeSeries";
import ChartSegment, {ChartDrawMode} from "./ChartSegment";

export const ChartDisplayMode  = {
    Full: 0,
    Mini: 1,
    MiniWithTitle: 2,
};

var _miniWidth = 0;
var _miniHeight = 0;

export default class OverTimeVisualization {
    constructor(parentElementSelection, evaluator, displayMode = ChartDisplayMode.Full) {
        // Public variables
        this.showSmoothedData = -1;
        this.visible = true;

        this.evaluator = evaluator;

        this._beginDate = null;
        this._endDate = null;

        this._currentData = null;
        this._filteredData = null;
        this._benchmarkSeries = null;

        this.title = null;
        this.description = null;
        this.hoverManager = null;

        let thisViz = this;

        if (displayMode === ChartDisplayMode.Full) {
            this.title = new ChartTitle(parentElementSelection);
            this.title.didTapStatAdjective = function () {
                thisViz._didToggleStatAdjective();
            };
        }

        this.container = parentElementSelection
            .append("div")
            .attr("class", thisViz._containerClassForDisplayMode(displayMode))
            .append("div")
            .attr("class", thisViz._chartContainerClassForDisplayMode(displayMode));

        if (displayMode === ChartDisplayMode.Full) {
            this.description = new ChartDescription(parentElementSelection);
            this.description.didHoverDates = function (dates) {
                thisViz.hoverManager.highlightDates(dates);
            }
        }

        // Base SVG
        this.svg = this._svgForDisplayMode(displayMode);

        if (displayMode === ChartDisplayMode.MiniWithTitle) {
            this.miniTitle = this.container.append("div")
                .attr("class", "over-time-title-mini mini-title-text")
                .html(evaluator.title.replace(" ", "<br>"));
        }

        let gradientID = "ScaleTruncation" + Math.floor(1000000*Math.random());
        let gradient = this.svg.append("defs")
            .append("linearGradient")
            .attr("id", gradientID)
            .attr("x1", 0)
            .attr("x2", 0)
            .attr("y1", 0)
            .attr("y2", 1);
        gradient.append("stop").attr("offset", "0%").attr("stop-color", "white");
        gradient.append("stop").attr("offset", "33%").attr("stop-color", "white");
        gradient.append("stop").attr("offset", "100%").attr("stop-color", "rgba(255, 255, 255, 0)");

        // Top-level Containers
        this.xAxisContainer = this.svg.append("g").attr("class", "x-axis");
        this.barContainer = this.svg.append("g")
        this.trendContainer = this.svg.append("g");
        this.hoverContainer = this.svg.append("g").style("overflow", "visible");

        this.scaleTruncationMarker = this.svg.append("rect").attr("fill", "url(#" + gradientID + ")");

        this.yAxisContainer = this.svg.append("g").attr("class", "y-axis"); // Put the y axis over the data so that our labels always show up well
        this.xAxisLabelContainer = this.svg.append("g");

        this.renderer = new OverTimeRenderer(displayMode,
                                             this.container,
                                             this.svg,
                                             this.barContainer,
                                             this.trendContainer,
                                             this.xAxisContainer,
                                             this.yAxisContainer,
                                             this.xAxisLabelContainer,
                                             this.scaleTruncationMarker);

        if (displayMode === ChartDisplayMode.Full) {
            this.hoverManager = new HoverManager(this, this.renderer, this.hoverContainer, this.container);
        }

        this.setShowSmoothedData(true);
    }

    _svgForDisplayMode(displayMode) {
        let result = this.container
            .append( "svg" )
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("class", "svg-content over-time-svg");;

        if (displayMode === ChartDisplayMode.Full) {
            result = result.attr("viewbox", "0 0 100 100")
                           .attr("preserveAspectRatio", "none");
        }

        return result;
    }

    _containerClassForDisplayMode(displayMode) {
        if (displayMode !== ChartDisplayMode.Full) {
            return  "base-chart-container-mini unselectable";
        }

        return "base-chart-container content-column unselectable";
    }

    _chartContainerClassForDisplayMode(displayMode) {
        if (displayMode !== ChartDisplayMode.Full) {
            return  "time-chart-container-mini";
        }

        return "time-chart-container";
    }

    get hoverBoundsEvaluator() {
        if (this.hoverManager !== null) {
            return this.hoverManager.hoverBoundsEvaluator;
        }

        return null;
    }

    set hoverBoundsEvaluator(newEvaluator) {
        if (this.hoverManager !== null) {
            this.hoverManager.hoverBoundsEvaluator = newEvaluator;
        }
    }

    get benchmarkSeries() {
        return this._benchmarkSeries;
    }

    set benchmarkSeries(series) {
        this._benchmarkSeries = series;
        this._syncBenchmarkEvaluator();
    }

    setShowSmoothedData(shouldShowSmoothed) {
        if (shouldShowSmoothed === this.showSmoothedData) {
            return;
        }

        this.showSmoothedData = shouldShowSmoothed;
        this._didUpdateEvaluator();
    }

    setEvaluator(evaluator) {
        this.evaluator = evaluator;
        this._didUpdateEvaluator();
    }

    _syncBenchmarkEvaluator() {
        // Make sure our benchmark evaluator always matches the toggled behavior of our primary evaluator.
        // This handles cases where we remove a benchmark series, the primary evaluator gets toggled, and then a benchmark series is re-added.
        if (this._benchmarkSeries !== null) {
            if (this._benchmarkSeries.evaluator.toggleCount != this.evaluator.toggleCount) {
                this._benchmarkSeries.evaluator.toggleCount = this.evaluator.toggleCount - 1;
                this._benchmarkSeries.evaluator = this._benchmarkSeries.evaluator.toggledEvaluator();
            }
        }
    }

    hide(animated = false) {
        this.setVisible(false, animated);
    }

    show(animated = false) {
        this.setVisible(true, animated);
    }

    setVisible(visible, animated = false) {
        if (visible === this.visible) {
            return;
        }

        this.visible = visible;

        let display = visible ? "block" : "none";
        this.container.style("display", display);
        if (this.title !== null) {
            this.title.container.style("display", display);
        }
        if (this.description !== null) {
            this.description.container.style("display", display);
        }
    }

    redraw(animated = false, lockScale = false) {
        this.updateForData(this._currentData, animated, lockScale);
    }

    // data is expected as an array of InfectionSnapshots
    updateForData(data, animated, lockScale = false) {
        if (this.renderer.width === undefined) {
            this._parseDimensions();
        }

        let barEvaluators = this.evaluator.metricEvaluators;

        this._currentData = data;
        this._filteredData = this._filterDataWithEvaluators(data, barEvaluators);

        let normalized = this.evaluator.normalized;
        let allowNegativeNumbers = this.evaluator.allowNegative;
        this._barDataSeries = this._barDataFromRawData(this._filteredData, barEvaluators, normalized);
        this._averageDataSeries = null;

        let smoothedEvaluators = null;
        if (this.showSmoothedData) {
            smoothedEvaluators = Array.from(this._smoothedEvaluator.metricEvaluators);
            this._averageDataSeries = this._barDataFromRawData(this._filteredData, smoothedEvaluators, this._smoothedEvaluator.normalized);
        }

        if (this._benchmarkSeries !== null && !this._inComparisonMode()) {
            let benchmarkEvaluator = this._benchmarkSeries.evaluator;
            let filteredBenchmarkData = this._alignDataWithData(this._benchmarkSeries.data, this._filteredData);
            let processedBenchmarkData = this._barDataFromRawData(filteredBenchmarkData,
                                                                  Array.from(benchmarkEvaluator.metricEvaluators),
                                                                  benchmarkEvaluator.normalized)
            if (benchmarkEvaluator.smoothed) {
                this._averageDataSeries.push(...processedBenchmarkData);
            } else {
                this._barDataSeries.push(...processedBenchmarkData);
            }
        }

        if (this.hoverManager !== null) {
            let topIndex = this.topSeriesIndex();
            this.hoverManager.data = this._filteredData;
            this.hoverManager.displayedDataSeries = this._barDataSeries[topIndex];
            this.hoverManager.displayedAverageDataSeries = this._averageDataSeries[topIndex];
            this.hoverManager.evaluator = this.evaluator;
            this.hoverManager.averageEvaluator = this._smoothedEvaluator;
        }

        let displayedBarSeries = this._barDataSeries.filter(series => series.evaluator.display);
        let displayedTrendLineSeries = this._averageDataSeries.filter(series => series.evaluator.display);

        if (!lockScale) {
            let dateDomain = [this._earliestDataPoint(), this._latestDataPoint()];
            this.renderer.drawAxesForData(dateDomain,
                                          displayedBarSeries,
                                          displayedTrendLineSeries,
                                          this.evaluator,
                                          normalized,
                                          allowNegativeNumbers,
                                          animated);
        }

        let drawSegments = this._chartSegments();

        this.renderer.drawBars(displayedBarSeries, drawSegments, allowNegativeNumbers, animated);
        if (this.showSmoothedData) {
            this.renderer.drawTrendLines(displayedTrendLineSeries, drawSegments, animated);
        }

        this.renderer.drawAnnotations(displayedTrendLineSeries, animated);
    }

    updateDescriptionForRegion(region, isFirstChart = false) {
        if (this.description !== null) {
            this.description.updateForData(this._filteredData, region, this.evaluator, this._smoothedEvaluator, isFirstChart);
        }
    }

    fixTimeDomain(beginDate, endDate) {
        this._beginDate = beginDate;
        this._endDate = endDate;
    }

    _didToggleStatAdjective() {
        let newEvaluator = this.evaluator.toggledEvaluator();
        this.setEvaluator(newEvaluator);
    }

    _didUpdateEvaluator() {
        this._smoothedEvaluator = this.showSmoothedData ? Evaluator.smoothedCopy(this.evaluator) : null;
        if (this.title !== undefined && this._filteredData !== null) {
            if (this.title !== null) {
                this.title.updateForContextChange(this.evaluator, this.title.region, this.title.groupByUnit);
            }
            if (this.description !== null) {
                this.description.updateForData(this._filteredData, this.description.region, this.evaluator, this._smoothedEvaluator);
            }
        }

        this._syncBenchmarkEvaluator();
        this._didUpdate(true);
    }

    _parseDimensions() {
        let isMini = this.renderer.isMini();
        if (isMini && _miniWidth === 0) {
            _miniWidth = parseInt(this.container.style('width'));
            _miniHeight = parseInt(this.container.style('height'));
        }
        let containerWidth = isMini ? _miniWidth : parseInt(this.container.style('width'));
        let containerHeight = isMini ? _miniHeight : parseInt(this.container.style('height'));
        let needsUpdate =  this.renderer.updateForDimensions(containerWidth, containerHeight);
        return needsUpdate;
    }

    topSeriesIndex() {
        let evaluators = this.evaluator.metricEvaluators;
        for (let i = evaluators.length - 1; i >= 0; i--) {
            if (evaluators[i].display) {
                return i;
            }
        }
        return -1;
    }

    didResize() {
        if (this._parseDimensions()) {
            this.updateForData(this._currentData, false);
        }
    }

    _chartSegments() {
        if (this.hoverManager !== null) {
            return this.hoverManager.chartSegments();
        }

        return [ChartSegment.baseSegmentForData(this._filteredData)];
    }

    _inComparisonMode() {
        if (this.hoverManager !== null) {
            return this.hoverManager.inComparisonMode();
        }

        return false;
    }

    _earliestDataPoint() {
        return (this._beginDate !== null) ? this._beginDate : min(this._currentData, d => d.date);
    }

    _latestDataPoint() {
        return (this._endDate !== null) ? this._endDate : max(this._currentData, d => d.date);
    }

    _didUpdate(animated = false) {
        if (this._currentData !== undefined && this._currentData !== null) {
            this.updateForData(this._currentData, animated);
        }
    }

    _barDataFromRawData(data, evaluators, normalize) {
        let stackFunction = stack()
            .keys(evaluators)
            .value(function (d, evaluator){
                return evaluator.valueForSnapshot(d);
            });
        if (normalize) {
            stackFunction = stackFunction.offset(stackOffsetExpand);
        }

        let dataResult = stackFunction(data);
        let seriesResult = [];
        dataResult.forEach(function (dataset, index) {
            seriesResult.push(new OverTimeSeries(dataset, evaluators[index]));
        });
        return seriesResult;
    }

    _alignDataWithData(inputData, dataToMatch) {
        if (dataToMatch === null || dataToMatch.length === 0) {
            return [];
        }
        let firstDate = dataToMatch.first().date;
        let lastDate = dataToMatch.last().date;
        let result = inputData.filter(function (snapshot){
            return snapshot.date >= firstDate && snapshot.date <= lastDate;
        });
        return result;
    }

    _filterDataWithEvaluators(data, evaluators) {
        return data.filter(function(snapshot) {
            for (let i = 0; i < evaluators.length; i++) {
                let stat = evaluators[i].statForSnapshot(snapshot);
                if (stat !== null) {
                    if (evaluators[i].filterFunction !== null) {
                        let dataIsValid = evaluators[i].filterFunction(evaluators[i], snapshot);
                        if (!dataIsValid) {
                            return false;
                        }
                    }
                    return true;
                }
            }
            return false;
        });
    }
}