import {axisBottom, axisLeft} from "d3-axis";
import {format} from "d3-format";
import {line} from "d3-shape";
import {max, min} from "d3-array";
import {scaleLinear, scaleTime} from "d3-scale";
import {timeFormat} from "d3-time-format";

import ChartSegment, {ChartDrawMode} from "./ChartSegment";
import DrawingUtils from "./DrawingUtils";
import {ChartDisplayMode} from './OverTimeVisualization.js'
import {denormalizeDate, normalizeDate, numDaysBetweenDates} from "./DateUtils";

import {REGION_TRANSITION_DURATION} from "./Constants";

export const AnnotationOrientation  = {
    Above: 0,
    Below: 1,
    None: 2,
};

export const AnnotationPlacement  = {
    WeekAgo: 0,
    AtDataMax: 1,
};

const ANNOTATION_CALLOUT_LENGTH = 10;
const ANNOTATION_CALLOUT_SPACING = 0;
const ANNOTATION_LINE_HEIGHT = 12;
const ANNOTATION_TEXT_HEIGHT = 28;
const ANNOTATION_TOTAL_HEIGHT = ANNOTATION_CALLOUT_LENGTH + ANNOTATION_CALLOUT_SPACING + ANNOTATION_TEXT_HEIGHT;

export default class OverTimeRenderer {
    constructor(displayMode, chartContainer, SVG, barContainer, trendContainer, xAxisContainer, yAxisContainer, xAxisLabelContainer, truncatedScaleMarker) {

        this.displayMode = displayMode;

        this.chartContainer = chartContainer;
        this.svg = SVG;
        this.barContainer = barContainer;
        this.trendContainer = trendContainer;
        this.xAxisContainer = xAxisContainer;
        this.yAxisContainer = yAxisContainer;
        this.xAxisLabelContainer = xAxisLabelContainer;
        this.truncatedScaleMarker = truncatedScaleMarker;

        this.margin =  OverTimeRenderer._marginForDisplayMode(displayMode);
        this.currentCapHeightOffset = 0;

        this.viewX = null;
        this.viewY = null;

        this.trendLine = line().x(function(d) {return d[0];})
                               .y(function(d) {return d[1];});
    }

    updateForDimensions(newWidth, newHeight) {
        let oldWidth = this.width;
        let oldHeight = this.height;

        this.width = newWidth;
        this.height = newHeight;

        if (this.width !== oldWidth || this.height !== oldHeight) {
            this.rescaleAxes();
            return true;
        }

        return false;
    }

    rescaleAxes() {
        this.viewY = scaleLinear().range([this.height - this.margin.bottom, this.margin.top]).clamp(true);
        this.viewX = scaleTime().range([this.margin.left, this.width - this.margin.right]);
    }

    yAxisPaddingFactor() {
        return (this.isMini()) ? 1.0 : 1.1;
    }

    animationSpeed() {
        return REGION_TRANSITION_DURATION;
    }

    workingWidth() {
        return this.width - this.margin.left - this.margin.right;
    }

    workingHeight() {
        return this.height - this.margin.top - this.margin.bottom;
    }

    numBarsInDomain() {
        let workingDomain = this.xDomain;
        if (workingDomain === null || workingDomain === undefined) {
            workingDomain = this._dateDomainOffsetForDisplay(this.dateDomain);
        }
        return Math.round(Math.abs(numDaysBetweenDates(workingDomain[0], workingDomain[1])));
    }

    barWidth() {
        return this._barWidthForDomainSize(this.numBarsInDomain(), this.barPadding());
    }

    _barWidthForDomainSize(nBars, padding) {
        let paddingWidth = (nBars - 1) * padding;
        return (this.workingWidth() - paddingWidth) / nBars;
    }

    static _marginForDisplayMode(displayMode) {
        if (displayMode === ChartDisplayMode.Full) {
            return {top: 0, left: 0, bottom: 18.5, right: 0};
        }

        return {top: 0, left: 0, bottom: 0, right: 0};
    }

    barPadding() {
        let nBars = this.numBarsInDomain();
        let defaultPadding = 4.0;
        let minBarWidth = 2.0;
        let paddingBarFactor = 4.0;
        let currentBarWidth = this._barWidthForDomainSize(nBars, defaultPadding);
        while(((currentBarWidth < minBarWidth) || (currentBarWidth / defaultPadding < paddingBarFactor)) && defaultPadding > 0) {
            defaultPadding--;
            currentBarWidth = this._barWidthForDomainSize(nBars, defaultPadding);
        }

        let paddingMin = (this.isMini()) ? 0.0 : 0.75;
        return Math.max(defaultPadding, paddingMin);
    }

    _segmentForIndex(dataIndex, segments) {
        for(let i = 0; i < segments.length; i++) {
            if (segments[i].contains(dataIndex)) {
                return segments[i];
            }
        }

        console.log("ERROR: no chart drawing behavior found for index: " + dataIndex);
        debugger;
        return null;
    }

    _dateDomainOffsetForDisplay(dateDomain) {
        let beginDateDomain = dateDomain[0].addDays(this.isMini() ? 0 : -2);
        let endDateDomain = dateDomain[1].addDays(1);
        return [beginDateDomain, endDateDomain];
    }

    isMini() {
        return (this.displayMode === ChartDisplayMode.Mini)
            || (this.displayMode === ChartDisplayMode.MiniWithTitle);
    }

    _trendLineClass() {
        if (this.isMini()) {
            return "trend-line-mini";
        }

        return "trend-line";
    }

    drawXAxis(tickDates, allowNegativeNumbers, displayAsPercent, animated) {
        let speed = this.animationSpeed();
        let renderer = this;
        let tickFormatter = timeFormat("%B %e");
        // Flip the orientation of the ticks if we don't have enough days to give them room
        let daysCovered = numDaysBetweenDates(tickDates[0], tickDates[1]);
        let flipFirstTickOrientation = (daysCovered < 45);
        let hideFirstTick = (daysCovered < 22);
        let firstCheck = function(index, data) { return index === 0; };
        let lastCheck = function (index, data) { return index === data.length - 1; };
        if (flipFirstTickOrientation) {
            firstCheck = function (index, data) { return false; };
            lastCheck = function (index, data) { return true; };
        }
        let tickSelection = this.xAxisLabelContainer.selectAll("text")
            .data(hideFirstTick ? [tickDates[1]] : tickDates, function (data, index) {
                return index;
            })
            .join(function (enter) {
                return enter.append("text")
                    .attr("class", "over-time-x-label")
                    .attr("dy", "1.35em")
                    .attr("y", 0)
                    .attr("x", d => renderer.viewX(d));
            });

        if (animated) {
            tickSelection = tickSelection.transition().duration(speed);
        }

        tickSelection.attr("x", d => renderer.viewX(d))
            .attr("first", function (tick, index, data) {
                return firstCheck(index, data) ? "" : null;
            })
            .attr("last", function (tick, index, data) {
                return lastCheck(index, data) ? "" : null;
            })
            .text(d => tickFormatter(d));

        let needsXAxis = !displayAsPercent && !allowNegativeNumbers;

        let xAxisTransform = `translate(0, ${this.height - this.margin.bottom})`;
        let newXAxis = axisBottom(this.viewX)
            .tickValues([])
            .tickSize(0);
        let xAxisUpdate = this.xAxisContainer
            .attr("transform", xAxisTransform);
        if (animated) {
            xAxisUpdate = xAxisUpdate.transition().duration(speed);
        }
        xAxisUpdate.call(newXAxis)
                   .style("opacity", needsXAxis ? 1.0 : 0.0);
        let xAxisLabelTransform = `translate(0, ${this.height - this.margin.bottom})`
        this.xAxisLabelContainer.attr("transform", xAxisLabelTransform);
    }

    drawYAxis(domain, evaluator, maxYValueDisplayed, normalized, displayAsPercent, allowNegativeNumbers, animated) {
        let speed = this.animationSpeed();
        let renderer = this;

        let yTickCount = 3;
        let newYTicks = this.viewY.ticks(yTickCount);
        let topTickY = this.viewY(newYTicks[newYTicks.length - 1]);
        let topDataY = this.viewY(maxYValueDisplayed);
        this._visualTopY = (topTickY < topDataY) ? topTickY : this.viewY.range()[1];
        let labelOffset = 15;
        let topEdgeY = topTickY - labelOffset;
        let offset = -topEdgeY;

        if (offset > 0 && (offset - this.currentCapHeightOffset) > 2) {
            let svgSelection = this.svg;
            if (animated) {
                svgSelection = svgSelection.transition().duration(speed);
            }
            this.currentCapHeightOffset = offset;
            svgSelection.style("transform", "translateY(" + this.currentCapHeightOffset + "px)");
            this.chartContainer.style("padding-bottom", this.currentCapHeightOffset + "px");
        }

        let newYAxis = axisLeft(this.viewY)
            .ticks(yTickCount)
            .tickSize(-this.workingWidth())
            .tickFormat(function(d, i, allTicks) {
                let formatSpecifier = renderer.viewY.tickFormat(yTickCount);
                if (normalized || displayAsPercent) {
                    formatSpecifier = ".0%";
                }

                let result = format(formatSpecifier)(d);
                if (displayAsPercent && result === "0%") {
                    result = "Baseline";
                } else {
                    let minIsGreater = Math.abs(domain[0]) > Math.abs(domain[1]);
                    let labeledIndex = (allowNegativeNumbers && minIsGreater) ? 0 : allTicks.length - 1;
                    if (i === labeledIndex) {
                        result += " " + evaluator.graphedNoun();
                    }
                }
                return result;
            });

        let yAxisUpdate = this.yAxisContainer.attr("transform", `translate(${this.margin.left}, 0)`);
        if (animated) {
            yAxisUpdate = yAxisUpdate.transition().duration(speed);
        }
        yAxisUpdate.call(newYAxis)
            .attr("fill", null)
            .selectAll("g.tick text")
            .attr("class", "grid-line-label")
            .attr("dy", "-0.41em")
            .attr("x", 0);


        this.yAxisContainer.selectAll("g.tick line").attr("class", "grid-line");
        if (displayAsPercent || allowNegativeNumbers) {
            this.yAxisContainer
                .selectAll("g.tick line")
                .filter(function (d) {
                    return (d === 0);
                })
                .attr("class", "grid-line-baseline");
        }

        this.yAxisContainer.selectAll("path.domain").style("display", "none");
    }

    drawScaleTruncationMarker(scaleIsTruncated, yRangeMax, animated) {
        let speed = this.animationSpeed();

        let gradientSelection = this.truncatedScaleMarker;
        if (animated) {
            gradientSelection = gradientSelection.transition().duration(speed);
        }
        gradientSelection.attr("x", 0)
            .attr("y", scaleIsTruncated ? (this.viewY(yRangeMax) - 2) : -30)
            .attr("height", 30)
            .attr("width", this.width)
            .style("opacity", scaleIsTruncated ? 1.0 : 0.0);
    }

    drawAxesForData(dateDomain, barSeries, trendSeries, chartEvaluator, normalized, allowNegativeNumbers, animated) {

        this.dateDomain = dateDomain;

        let earliestDataPoint = dateDomain[0];
        let latestDataPoint = dateDomain[1];

        let baseDisplayedDomain = this._dateDomainOffsetForDisplay(dateDomain);

        // If we're in mini mode, only display trend-lines
        let allDisplayedSeries = this.isMini() ? trendSeries :  barSeries.concat(trendSeries);

        let scaleParameters = DrawingUtils.scaleParametersForSeries(this.displayMode, barSeries, trendSeries, normalized, allowNegativeNumbers);

        let bottomSeries = barSeries.first();

        // We need the x-domain to end where the final bar ends.
        // A "day" spans the width of a bar and its padding.
        // To land on the end of the bar (and not the bar + padding), calculate how many "days" a bar spans.
        // Our latest datapoint date, offset by barsWorthOfDays, is where the domain will end.
        let barsWorthOfDays = this.barWidth() / (this.barWidth() + this.barPadding());
        let beginDateDomain = baseDisplayedDomain[0];
        let endOfFinalDay = denormalizeDate(latestDataPoint.addDays(barsWorthOfDays)); // Date.addDays normalizes by default. Avoid doing it twice (normalization happens below).

        let displayAsPercent = bottomSeries.evaluator.displayAsPercent;

        this.xDomain = [normalizeDate(beginDateDomain), normalizeDate(endOfFinalDay)];

        let yDataMax = max(allDisplayedSeries, series => max(series.data, function(d){
            return d[1];
        }));
        let yDataMin = min(allDisplayedSeries, series => min(series.data, function(d) {
            if (allowNegativeNumbers) {
                return Math.min(d[0], d[1]);
            }
            return d[0];
        }));
        let maxYValueDisplayed = scaleParameters.useOvershoot ? scaleParameters.yDataMax : yDataMax;
        let yDisplayedRangeMax = scaleParameters.useOvershoot ? scaleParameters.yMax : this.yAxisPaddingFactor() * yDataMax;
        let yDisplayedRangeMin = this.yAxisPaddingFactor() * Math.min(yDataMin, 0); // Don't start above zero, but support negative numbers.
        this.yDomain = [yDisplayedRangeMin, yDisplayedRangeMax];

        // If we are miniature, always expand to data scale to fill available space.
        let drawDomain = this.isMini() ? this._displayedDateDomainForSeries(allDisplayedSeries) : this.xDomain;
        this.viewX.domain(drawDomain);
        this.viewY.domain(this.yDomain);

        // Tick at the first data point we display, and at the end of the final day displayed
        this.displayedDateRange = this._visibleDateRangeForSeries(barSeries, [earliestDataPoint, endOfFinalDay], barsWorthOfDays);

        if (!this.isMini()) {
            this.drawScaleTruncationMarker(scaleParameters.useOvershoot, yDisplayedRangeMax, animated);
            this.drawXAxis(this.displayedDateRange, yDataMin < 0, displayAsPercent, animated);
            this.drawYAxis(this.yDomain,
                chartEvaluator,
                maxYValueDisplayed,
                normalized,
                displayAsPercent,
                allowNegativeNumbers,
                animated);
        }
    }

    _displayedDateDomainForSeries(allSeries) {
        let domainMin = min(allSeries, series => min(series.data, function(d){
            return d.data.date;
        }));
        let domainMax = max(allSeries, series => max(series.data, function(d){
            return d.data.date;
        }));
        return [domainMin, domainMax];
    }

    _visibleDateRangeForSeries(allSeries, defaultDomain, barsWorthOfDays = 0.99) {
        let isDataEmpty = (allSeries[0].data.length === 0);
        let result = [];
        if (!isDataEmpty) {
            let earliestDisplayedPoint = min(allSeries, d => d.data[0].data.date);
            let latestDisplayedPoint = max(allSeries, d => d.data[d.data.length - 1].data.date);
            let latestTickValue = latestDisplayedPoint.addDays(barsWorthOfDays);
            result = [normalizeDate(earliestDisplayedPoint), latestTickValue];
        } else {
            result = [normalizeDate(defaultDomain[0]), normalizeDate(defaultDomain[1])];
        }

        return result;
    }

    _dataIndexForAnnotation(series) {
        let result = 0;
        switch(series.evaluator.annotationPlacement) {
            case AnnotationPlacement.AtDataMax: {
                let maxIndex = 0;
                let currentMax = 0;
                series.data.forEach(function (d, i) {
                    let value = Math.abs(d[1]);
                    if (value > currentMax) {
                        currentMax = value;
                        maxIndex = i;
                    }
                });
                result = maxIndex;
            }
            case AnnotationPlacement.WeekAgo: {
                let daysBack = 7;
                let index = series.data.length - daysBack;
                if (index < daysBack) {
                    index = series.data.length - 1;
                }
                result = index;
            }
        }

        result = Math.max(result, 0);
        result = Math.min(result, series.data.length - 1);

        return result;
    }

    _annotationPointForSeries(series, index = null) {
        if (index === null) {
            index = this._dataIndexForAnnotation(series);
        }

        if (series.data[index] === undefined) {
            return null;
        }

        let snapshot = series.data[index].data;
        let value = series.data[index][1];
        let x = this.viewX(snapshot.normalizedDate()) + 0.5 * this.barWidth();
        let y = this.viewY(value);

        return [x, y];
    }

    _annotationTransformForSeries(series, orientation = AnnotationOrientation.Below) {
        let point = this._annotationPointForSeries(series);
        if (point === null) {
            return "translate(0,0)";
        }
        if (orientation === AnnotationOrientation.Above) {
            point[1] -= ANNOTATION_TOTAL_HEIGHT;
        }
        return "translate(" + point[0] + "," + point[1] + ")";
    }

    _annotationCalloutBeginForSeries(series, orientation = AnnotationOrientation.Below) {
        if (orientation === AnnotationOrientation.Above) {
            return ANNOTATION_TEXT_HEIGHT + ANNOTATION_CALLOUT_SPACING;
        }
        return 0;
    }

    _annotationCalloutEndForSeries(series, orientation = AnnotationOrientation.Below) {
        return this._annotationCalloutBeginForSeries(series, orientation) + ANNOTATION_CALLOUT_LENGTH;
    }

    _annotationTextTransformForSeries(series, orientation = AnnotationOrientation.Below) {
        let yOffset = 0;
        if (orientation === AnnotationOrientation.Below) {
            yOffset = (ANNOTATION_CALLOUT_LENGTH + ANNOTATION_CALLOUT_SPACING);
        }
        return "translate(-10, " + yOffset + ")";
    }

    _annotationOrientationsForSeries(annotatedSeries, allSeries) {
        let renderer = this;
        let orientations = annotatedSeries.map(function (series) {
            let annotationIndex = renderer._dataIndexForAnnotation(series);
            let annotationPoint = renderer._annotationPointForSeries(series, annotationIndex);
            if (annotationPoint === null) {
                return AnnotationOrientation.None;
            }
            let isAboveAll = true;
            allSeries.forEach(function (competingSeries) {
                if (competingSeries !== series) {
                    let competingPoint = renderer._annotationPointForSeries(competingSeries, annotationIndex);
                    if (competingPoint !== null && annotationPoint[1] > competingPoint[1]) {
                        isAboveAll = false;
                    }
                }
            });
            let naturalOrientation = isAboveAll ? AnnotationOrientation.Above : AnnotationOrientation.Below;
            let resultingOrientation = naturalOrientation;
            let annotationHeightVector = (naturalOrientation === AnnotationOrientation.Above) ? -ANNOTATION_TOTAL_HEIGHT : ANNOTATION_TOTAL_HEIGHT;
            let annotationBoundingY = annotationPoint[1] + annotationHeightVector;
            if (annotationBoundingY < renderer.viewY.range[0]) {
                resultingOrientation = AnnotationOrientation.Below;
            }
            if (annotationBoundingY > renderer.viewY.range[1]) {
                resultingOrientation = AnnotationOrientation.Above;
            }
            return resultingOrientation;
        });

        return orientations;
    }

    drawAnnotations(allSeries, animated) {
        if (this.isMini()) {
            return;
        }

        let renderer = this;
        let speed = this.animationSpeed();

        let annotatedSeries = allSeries.filter(function (series) { return series.evaluator.annotation !== null && series.data.length > 0; });
        let orientations = this._annotationOrientationsForSeries(annotatedSeries, allSeries);

        let annotationSelection = this.yAxisContainer.selectAll("g.annotation")
                                    .data(annotatedSeries, function (series) {
                                        return series.evaluator.hashString();
                                    })
                                    .join(function (enter) {
                                        return enter.append("g").attr("class", "annotation")
                                            .attr("opacity", 0.0)
                                            .attr("transform", function (series, index) {
                                                return renderer._annotationTransformForSeries(series, orientations[index]);
                                            })
                                            .append("line")
                                            .attr("class", "annotation-callout")
                                            .attr("x1", 0)
                                            .attr("y1", function (series, index) {
                                                return renderer._annotationCalloutBeginForSeries(series, orientations[index]);
                                            })
                                            .attr("x2", 0)
                                            .attr("y2", function (series, index) {
                                                return renderer._annotationCalloutEndForSeries(series, orientations[index]);
                                            })
                                            .select(function() { return this.parentNode; })
                                            .append("text")
                                            .attr("class", "annotation-label")
                                            .attr("transform", function (series, index) {
                                                return renderer._annotationTextTransformForSeries(series, orientations[index]);
                                            })
                                            .attr("dy", ANNOTATION_LINE_HEIGHT)
                                            .html(function (series) {
                                                return series.evaluator.annotation;
                                            }).select(function() { return this.parentNode; });
                                    },
                                    function(update) {
                                        return update;
                                    },
                                    function(exit) {
                                        if (animated) {
                                            exit = exit.transition().duration(speed);
                                        }
                                        return exit.attr("opacity", 0.0).remove();
                                    })

        if (animated) {
            annotationSelection = annotationSelection.transition().duration(speed);
        }
        annotationSelection.attr("transform", function (series, index) {
            return renderer._annotationTransformForSeries(series, orientations[index]);
        }).attr("opacity", 1.0)
            .select("text")
            .attr("transform", function (series, index) {
                return renderer._annotationTextTransformForSeries(series, orientations[index]);
            })
            .select(function() { return this.parentNode; })
            .select("line")
            .attr("y1", function (series, index) {
                return renderer._annotationCalloutBeginForSeries(series, orientations[index]);
            })
            .attr("y2", function (series, index) {
                return renderer._annotationCalloutEndForSeries(series, orientations[index]);
            });
    }

    drawBars(barSeries, drawSegments, allowNegativeNumbers, animated) {
        if (this.isMini()) {
            return;
        }

        let speed = this.animationSpeed();

        // Create an svg group for each series to be drawn
        let renderer = this;
        this.barContainer.selectAll("g")
            .data(barSeries, function(series) {
                return series.evaluator.hashString();
            })
            .join(function(enter) {
                    return enter.append("g")
                        .attr("class", "over-time-series")
                        .attr("evaluatorID", function (series) {
                            return series.evaluator.hashString();
                        })
                }
            );

        barSeries.forEach(function (series, index) {
            let seriesEvaluator = series.evaluator;
            let dataset = series.data;

            let evalKey = seriesEvaluator.hashString();
            let seriesContainer = renderer.barContainer.selectAll("g[evaluatorID='" + evalKey + "']").first();
            let rectSelection = seriesContainer.selectAll("rect")
                .data(dataset, d => d.data.dateString)
                .join(function (enter) {
                    return enter.append("rect")
                        .attr("dateID", d => OverTimeRenderer.rectDateID(d.data))
                        .attr("x", d => renderer.viewX(d.data.normalizedDate()))
                        .attr("width", renderer.barWidth())
                        .attr("y", renderer.viewY(0))
                        .attr("height", 0);
                });

            if (animated) {
                rectSelection = rectSelection.transition().duration(speed);
            }

            rectSelection.attr("y", function (d) {
                return Math.min(renderer.viewY(d[0]), renderer.viewY(d[1]));
            })
                .attr("height", function (d) {
                    let difference = renderer.viewY(d[0]) - renderer.viewY(d[1]);
                    if (allowNegativeNumbers) {
                        difference = Math.abs(difference);
                    } else {
                        difference = Math.max(difference, 0);
                    }
                    return difference;
                })
                .attr("width", renderer.barWidth())
                .attr("fill", function (data, index) {
                    let drawSegment = renderer._segmentForIndex(index, drawSegments);
                    return ChartSegment.colorForEvaluator(seriesEvaluator, drawSegment.drawMode);
                })
                .attr("x", d => renderer.viewX(d.data.normalizedDate()));
        });

        this.barContainer.style("opacity", this.showingTrendOverlay() ? 0.25 : 1.0);
    }

    showingTrendOverlay() {
        return true;
    }

    drawTrendLines(trendLineSeries, drawSegments, animated) {

        // Reverse our drawing order so we draw the bottom stack last
        // (otherwise fill from above will partially cover trendline)
        trendLineSeries = trendLineSeries.concat().reverse();

        let speed = this.animationSpeed();

        // Create an svg group for every series
        let groupSelection = this.trendContainer.selectAll("g")
            .data(trendLineSeries, function(series) {
                return series.evaluator.hashString();
            })
            .join(function(enter) {
                    return enter.append("g")
                        .attr("class", "over-time-series-trend")
                        .attr("evaluatorID", function (series) {
                            return series.evaluator.hashString();
                        })
                        .style("opacity", 0.0)
                },
                function(update) {
                    return update;
                },
                function(exit) {
                    if (animated) {
                        exit = exit.transition().duration(speed);
                    }
                    return exit.style("opacity", 0.0).remove();
                }
            );
        if (animated) {
            groupSelection = groupSelection.transition().duration(speed);
        }
        groupSelection.style("opacity", 1.0);

        let renderer = this;
        // For every series, draw the relevant trend line
        trendLineSeries.forEach(function (series, seriesIndex) {
            let seriesEvaluator = series.evaluator;
            let dataset = series.data;

            let evalKey = seriesEvaluator.hashString();
            let seriesContainer = renderer.trendContainer.selectAll("g[evaluatorID='" + evalKey + "']").first();

            // For every draw segment, add a separate line segment and associated fill
            let trendFillPaths = [];
            let trendLines = [];
            drawSegments.forEach(function (drawSegment) {
                let linePoints = [];
                let fillPoints = [];
                OverTimeRenderer.computeTrendLinePoints(renderer, dataset, linePoints, fillPoints, drawSegment);
                trendLines.push(linePoints);
                trendFillPaths.push(fillPoints);
            });

            // Bind a path for every fill
            seriesContainer.selectAll("path.trend-line-fill")
                .data(trendFillPaths, function(d, index) { return "trendFill" + index; })
                .join(enter => enter.append("path")
                        .attr("class", "trend-line-fill")
                        .attr("fill", function(d, index){
                            let segment = drawSegments[index];
                            return ChartSegment.colorForEvaluator(seriesEvaluator, segment.drawMode, seriesEvaluator.wantsFill ? 0.2 : 0);
                        })
                        .attr("d", renderer.trendLine),
                    function(update) {
                        if (animated) {
                            update = update.transition().duration(speed);
                        }
                        return  update.attr("fill", function(d, index){
                                    let segment = drawSegments[index];
                                    return ChartSegment.colorForEvaluator(seriesEvaluator, segment.drawMode,seriesEvaluator.wantsFill ? 0.2 : 0);
                                })
                                .attr("d", renderer.trendLine);
                    }
                );

            // Bind a path for every line
            let lineSelection = seriesContainer.selectAll("path." + renderer._trendLineClass())
                .data(trendLines, function(d, index) { return "trendLine" + index; })
                .join(enter => enter.append("path")
                                            .attr("class", renderer._trendLineClass())
                                            .attr("stroke", function(d, index){
                                                let segment = drawSegments[index];
                                                return ChartSegment.colorForEvaluator(seriesEvaluator, segment.drawMode);
                                            })
                                            .attr("d", renderer.trendLine),
                );
            if (animated) {
                lineSelection = lineSelection.transition().duration(speed);
            }
            lineSelection.attr("stroke", function(d, index){
                            let segment = drawSegments[index];
                            return ChartSegment.colorForEvaluator(seriesEvaluator, segment.drawMode);
                         })
                         .attr("d", renderer.trendLine);
        });
    }

    static computeTrendLinePoints(renderer, data, linePoints, fillPoints, chartSegment = null) {
        let beginIndex = (chartSegment === null) ? 0 : chartSegment.beginIndex;
        let endIndex = (chartSegment === null) ? data.length - 1 : chartSegment.endIndex;
        let drawMode = (chartSegment === null) ? ChartDrawMode.Default : chartSegment.drawMode;

        let bottomPoints = [];
        let halfBarWidth = renderer.barWidth() / 2.0;
        for (let i = beginIndex; (i <= endIndex && i < data.length); i++) {
            let d = data[i];
            let isFirst = (i === 0);
            let isLast = (i === data.length - 1);
            let x = renderer.viewX(d.data.normalizedDate());
            if (isLast && data.length > 1) {
                x += 2.0 * halfBarWidth;
            } else if (!isFirst || data.length === 1) {
                x += halfBarWidth;
            }

            let topPoint = [x, renderer.viewY(d[1])];
            let bottomPoint = [x, renderer.viewY(d[0])];

            // This is a lot of logic to make sure that inactive fill always defers
            // to other drawing modes when it comes to splitting bars.
            let fillPointX = x;
            if (!isFirst && !isLast) {
                let isBeginning = (i === beginIndex);
                let isEnd = (i === endIndex);
                if (drawMode === ChartDrawMode.Inactive) {
                    if (isEnd) {
                        fillPointX -= halfBarWidth;
                    } else if (isBeginning) {
                        fillPointX += halfBarWidth;
                    }
                } else {
                    if (isEnd) {
                        fillPointX += halfBarWidth;
                    } else if (isBeginning) {
                        fillPointX -= halfBarWidth;
                    }
                }
            }

            linePoints.push(topPoint);
            fillPoints.push([fillPointX, topPoint[1]]);
            bottomPoints.push([fillPointX, bottomPoint[1]]);
        }

        // Repeat the number of path points so that svg animation will work out
        let numPointsRequired = renderer.numBarsInDomain();
        while (linePoints.length < numPointsRequired && linePoints.length > 0) {
            linePoints.unshift(linePoints[0]);
        }
        while (fillPoints.length < numPointsRequired && fillPoints.length > 0) {
            fillPoints.unshift(fillPoints[0]);
        }
        while (bottomPoints.length < numPointsRequired && bottomPoints.length > 0) {
            bottomPoints.unshift(bottomPoints[0]);
        }

        // Add the bottom points after the top points
        bottomPoints.reverse();
        fillPoints.push(...bottomPoints);
    }

    static rectDateID(infectionSnapshot) {
        return "date" + infectionSnapshot.dateString;
    }
}