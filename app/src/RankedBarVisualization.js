import { axisLeft, axisTop } from 'd3-axis';
import { event } from 'd3-selection';
import { format } from 'd3-format';
import { max } from 'd3-array';
import { scaleBand, scaleLinear } from 'd3-scale';

import ChartTitle from "./ChartTitle.js";
import { HashString } from "./Utils.js";

import { REGION_TRANSITION_DURATION } from "./Constants.js";
import CopyLinkButton from "./CopyLinkButton";

const BAR_FILL_COLOR = "rgb(252, 185, 163)";
const BAR_HIGHLIGHT_STROKE = "rgba(0, 0, 0, 1.0)";
const BAR_HIGHLIGHT_STROKE_WIDTH = 2.0;
const BAR_DEFAULT_STROKE = "none";
const BAR_DEFAULT_STROKE_WIDTH = 0.0;

export default class RankedBarVisualization {
    constructor(vizWidth, vizHeight, parentElementSelection, evaluator) {

        // Public variables
        this.numBars = 10;
        this.labelBarPadding = 6;
        this.labelFontSize = 7;
        this.margin = {top: 12, left: 110, bottom: 10, right: 10};

        // Callbacks
        this.onRegionMouseOver = null;
        this.onRegionMouseOut = null;
        this.onRegionClicked = null;

        this.evaluator = evaluator;

        // View-state
        this._highlightedRegionID = null;
        this._currentHighlightedData = null;
        this._currentData = null;

        this.title = new ChartTitle(parentElementSelection);
        let topContainer = parentElementSelection
            .append("div")
            .attr("class", "base-chart-container-ranked content-column");
        this.container = topContainer.append("div").attr("class", "ranked-chart-container");

        // Base SVG
        this.svg = this.container
            .append( "svg" )
            .attr( "width", "100%" )
            .attr( "height", "100%" )
            .style("overflow", "visible");

        // this.copyLinkButton = new CopyLinkButton(topContainer, evaluator);

        // Install background rect
        this.svg.append("rect")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("fill", "rgba(0,0,0,0)")
            .attr("stroke-width", "2px")
            .attr("stroke", "none");

        this.yAxisContainer = this.svg.append("g")
            .attr("class", "y-axis");

        this.xAxisContainer = this.svg.append("g")
            .attr("transform", `translate(0,${this.margin.top})`)
            .attr("class", "x-axis");

        this.barContainer = this.svg.append("g");

        this._summaryText = this.svg.append("text")
            .attr("x", 10)
            .attr("y", vizHeight - 10)
            .attr("class", "medium");

        let thisViz = this;
        this.title.didTapStatAdjective = function (title) {
            thisViz._didToggleStatAdjective();
        };
    }

    barHeight() {
        return 15;
    }

    _workingHeight() {
        return this.height - (this.margin.bottom + this.margin.top);
    }

    _rescaleAxes(){
        this.viewY = scaleBand()
            .range([this.margin.top, this.height - this.margin.bottom]).paddingOuter(0.25).align(0.75);

        this.viewX = scaleLinear()
            .range([this.margin.left, this.width - this.margin.right]);
    }

    _didToggleStatAdjective() {
        let newEvaluator = this.evaluator.toggledEvaluator();
        this.setEvaluator(newEvaluator);
    }

    didResize() {
        if (this._parseDimensions()) {
            this.updateForData(this._currentData, this._currentHighlightedData, false);
        }
    }

    _parseDimensions() {
        let oldWidth = this.width;
        let oldHeight = this.height;

        this.width = parseInt(this.svg.style('width'));
        this.height = parseInt(this.svg.style('height'));

        if (this.width !== oldWidth || this.height !== oldHeight) {
            this._rescaleAxes();
            return true;
        }

        return false;
    }

    setEvaluator(evaluator) {
        this.evaluator = evaluator;
        this.title.updateForContextChange(evaluator, this.title.region, this.title.groupByUnit);
        this.updateForData(this._currentData, this._currentHighlightedData, true);
    }

    _stringForNumber(number) {
        if (number < 1000) {
            return number.toString();
        } else {
            return format(",.2r")(number);
        }
    }

    hoverRegionWithID(regionID) {
        // If we're moving out of an active hover, defer to highlighting the current highlight data.
        if (!regionID && this._currentHighlightedData) {
            regionID = this._currentHighlightedData.region.ID;
        }

        // Reset old highlight
        if (this._highlightedRegionID) {
            this.barContainer.select("rect[regionID=" + RankedBarVisualization.rectRegionID(this._highlightedRegionID) + "]")
                .attr("stroke", BAR_DEFAULT_STROKE)
                .attr("stroke-width", BAR_DEFAULT_STROKE_WIDTH);
        }

        this._highlightedRegionID = regionID;

        // Apply new one.
        if (regionID) {
            this.barContainer.select("rect[regionID=" + RankedBarVisualization.rectRegionID(regionID) + "]")
                .attr("stroke", BAR_HIGHLIGHT_STROKE)
                .attr("stroke-width", BAR_HIGHLIGHT_STROKE_WIDTH);
        }
    }

    _strokeWidthForRegionID(regionID) {
        return (regionID === this._highlightedRegionID) ? BAR_HIGHLIGHT_STROKE_WIDTH : BAR_DEFAULT_STROKE_WIDTH;
    }

    _strokeForRegionID(regionID) {
        return (regionID === this._highlightedRegionID) ? BAR_HIGHLIGHT_STROKE : BAR_DEFAULT_STROKE;
    }

    updateAxesForData(data, animated) {
        let thisViz = this;
        this.xDomain = [0, 1.1 * max(data, d => thisViz.evaluator.valueForSnapshot(d))];
        this.viewX.domain(this.xDomain).nice();
        this.viewY.domain(data.map(d => d.region.name));

        let speed = REGION_TRANSITION_DURATION;

        let xAxisUpdate = this.xAxisContainer.attr("dummy", "marker");
        if (animated) {
            xAxisUpdate = xAxisUpdate.transition().duration(speed);
        }
        let numXTicks = 4;
        let newTickValues = this.viewX.ticks(numXTicks);
        if (newTickValues[0] === 0 && this.xDomain[1] >= 1000) {
            if (newTickValues[1] > 10000) {
                newTickValues[0] = 5000;
            } else if(newTickValues[1] > 1000) {
                newTickValues[0] = 500;
            } else {
                newTickValues[0] = 100;
            }
        }
        let newYAxis = axisTop(this.viewX)
            .ticks(numXTicks)
            .tickSize(-this._workingHeight())
            .tickValues(newTickValues);

        xAxisUpdate.call(
            newYAxis
        ).selectAll("text")
            .attr("class", "ranked-bar-tick-label");

        let yAxisUpdate = this.yAxisContainer.attr("transform","translate(4,0)");
        if (animated) {
            yAxisUpdate = yAxisUpdate.transition().duration(speed);
        }
        yAxisUpdate.call(
            axisLeft(this.viewY)
                .tickSize(0)
        )
            .attr("text-anchor", "begin")
            .selectAll("text")
            .attr("class", "ranked-bar-label unselectable");

        this.xAxisContainer.selectAll("g.tick line")
            .attr("class", "ranked-bar-line");
        this.yAxisContainer.selectAll("path.domain")
            .style("display", "none");
        this.xAxisContainer.selectAll("path.domain")
            .style("display", "none");
    }

    updateForData(newData, highlightedData, animated) {
        if (this.width === undefined) {
            this._parseDimensions();
        }

        this._currentData = newData;
        this._currentHighlightedData = highlightedData;

        let thisViz = this;

        let data = Array.from(newData.values());
        data.sort((snapshotA, snapshotB) => (thisViz.evaluator.valueForSnapshot(snapshotB)
                                                        - thisViz.evaluator.valueForSnapshot(snapshotA)));
        data = data.slice(0, this.numBars);
        data = data.filter(function(infectionSnapshot) {
            return thisViz.evaluator.valueForSnapshot(infectionSnapshot) > 0;
        });

        let displayedRegionIDs = data.map(snapshot => snapshot.region.ID);
        if (highlightedData !== null && !displayedRegionIDs.includes(highlightedData.region.ID)) {
            data.push(highlightedData);
        }

        this.updateAxesForData(data, animated);
        const speed = REGION_TRANSITION_DURATION;

        let barSelection = this.barContainer.selectAll("rect")
            .data(data, function(d) { return d.region.ID; })
            .join(function(enter) {
                    return enter.append("rect")
                        .attr("regionID", d => RankedBarVisualization.rectRegionID(d.region.ID))
                        .attr("width", 0)
                        .attr("x", thisViz.viewX(0))
                        .attr("height", thisViz.barHeight())
                        .attr("y", function(d) {
                            return thisViz.viewY(d.region.name) + 0.5*(thisViz.viewY.bandwidth() - thisViz.barHeight());
                        })
                        .on("mouseenter touchstart", function(currentFeature) {
                            thisViz._touchDidMove = false;
                            thisViz._didMouseOverRegion(thisViz, this, currentFeature);
                        })
                        .on("mouseleave touchmove", function(currentFeature) {
                            thisViz._touchDidMove = true;
                            thisViz._didMouseOutRegion(thisViz, this, currentFeature);
                        })
                        .on("touchend", function(currentFeature) {
                            if (!thisViz._touchDidMove) {
                                thisViz._didClickRegion(thisViz, this, currentFeature);
                                event.preventDefault();
                            }
                        })
                        .on("click", function(currentFeature) {
                            thisViz._didClickRegion(thisViz, this, currentFeature);
                            this._touchDidMove = false;
                            event.preventDefault();
                        });
                },
                function(update) {
                    return update;
                },
                function(exit) {
                    if (animated) {
                        exit = exit.transition().duration(speed);
                    }
                    return exit
                        .attr("width", 0)
                        .attr("transform", "translate(0," + thisViz._workingHeight() + ")")
                        .remove();
                }
            );

        if (animated) {
            thisViz.svg.style("overflow", "hidden");
            barSelection = barSelection.transition().duration(speed).on("end", function() {
                thisViz.svg.style("overflow", "visible");
            });
        }

        barSelection.attr("fill", BAR_FILL_COLOR)
            .attr("transform", "translate(0, 0)")
            .attr("stroke", d => thisViz._strokeForRegionID(d.region.ID))
            .attr("stroke-width", d => thisViz._strokeWidthForRegionID(d.region.ID))
            .attr("y", function(d) {
                return thisViz.viewY(d.region.name) + 0.5*(thisViz.viewY.bandwidth() - thisViz.barHeight());
            })
            .attr("height", thisViz.barHeight())
            .attr("width", d => (thisViz.viewX(thisViz.evaluator.valueForSnapshot(d)) - thisViz.viewX(0)))

        if (highlightedData !== null) {
            this.hoverRegionWithID(highlightedData.region.ID);
        } else {
            this.hoverRegionWithID(null);
        }
    }

    // Callbacks
    _didMouseOverRegion(thisChart, rect, infectionSnapshot) {
        if (thisChart.onRegionMouseOver) {
            thisChart.onRegionMouseOver(infectionSnapshot.region.ID);
        }
    }

    _didMouseOutRegion(thisChart, rect, infectionSnapshot) {
        if (thisChart.onRegionMouseOut) {
            thisChart.onRegionMouseOut(infectionSnapshot.region.ID);
        }
    }

    _didClickRegion(thisChart, rect, infectionSnapshot) {
        if (thisChart.onRegionClicked) {
            thisChart.onRegionClicked(infectionSnapshot.region.ID);
        }
    }

    // Hashing
    static rectRegionID(regionID) {
        if (regionID === undefined) {
            return "regionUndefined";
        }
        return "region" + HashString(regionID);
    }
}