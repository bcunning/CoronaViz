import {event, mouse, touches} from "d3-selection";

import HoverBarHighlight from "./HoverBarHighlight.js";
import HoverView from "./HoverView.js";
import HoverPoint from "./HoverPoint.js";
import {numDaysBetweenDates} from "./DateUtils";
import ChartSegment, {ChartDrawMode} from "./ChartSegment";

const SCRUB_MIN_LINGER_TIME = 200;

export default class HoverManager {

    constructor(viz, renderer, hoverDrawContainer, hoverDescriptionContainer) {
        this._hoverPoints = [];
        this._hoverHighlights = [];
        this._mouseDownPoint = null;
        this._hoverDidMove = false;
        this.hoverDescription = null;
        this.hoverBoundsEvaluator = null;

        this.data = null;
        this.displayedDataSeries = null;
        this.displayedAverageDataSeries = null;

        this.evaluator = null;
        this.averageEvaluator = null;

        let thisManager = this;
        this.viz = viz;
        this.renderer = renderer;
        this.hoverContainer = hoverDrawContainer;
        this.hoverTouchRect = hoverDrawContainer.append("rect")
            .attr("x", "-10%")
            .attr("width", "120%")
            .attr("height", "100%")
            .style("pointer-events", "all")
            .style("cursor", "grab")
            .attr("fill", "rgba(0,0,0,0)")
            .on("mouseenter touchstart", function () {
                thisManager._didStartHover(this);
            })
            .on("mousedown", function () {
                thisManager._didMouseDown(this);
            })
            .on("mouseup", function () {
                thisManager._didMouseUp(this);
            })
            .on("mousemove touchmove", function () {
                thisManager._didMoveHover(this);
            })
            .on("mouseleave touchend", function () {
                thisManager._didEndHover(this);
            });
        this.descriptionContainer = hoverDescriptionContainer;
    }

    highlightDates(dates) {
        let thisManager = this;
        let hoverPoints = dates.map(d => thisManager._hoverPointForDate(d)).filter(d => (d !== null));
        this._setHoverPoints(hoverPoints);
    }

    chartSegments() {
        if (this.inComparisonMode()) {
            let range = [0, this.data.length - 1];
            let firstBreak = this._hoverPoints[0].dataIndex;
            let secondBreak = this._hoverPoints[1].dataIndex;
            let firstSegment = new ChartSegment(range[0], firstBreak, ChartDrawMode.Inactive, range);
            let secondSegment = new ChartSegment(firstBreak, secondBreak, this.drawMode(), range);
            let thirdSegment = new ChartSegment(secondBreak, range[1], ChartDrawMode.Inactive, range);
            return [firstSegment, secondSegment, thirdSegment];
        }

        return [ChartSegment.baseSegmentForData(this.data)];
    }

    inComparisonMode() {
        return (this._hoverPoints.length >= 2);
    }

    _hoverPointsRequireUpdate(currentPoints, newPoints) {
        if (currentPoints.length !== newPoints.length) {
            return true;
        }

        for (let i = 0; i < currentPoints.length; i++) {
            let currentPoint = currentPoints[i];
            let newPoint = newPoints[i];
            if (!currentPoint.equals(newPoint)) {
                return true;
            }
        }
        return false;
    }

    _hoverPointsToCompare() {
        if (this._hoverPoints.length === 2) {
            if (this._hoverPoints[0].dataIndex === this._hoverPoints[1].dataIndex) {
                return [this._hoverPoints[0]];
            }
        }
        return this._hoverPoints;
    }

    drawMode() {
        if (this._hoverPoints.length === 2) {
            let firstSnapshot = this._hoverPoints[0].data;
            let secondSnapshot = this._hoverPoints[1].data;
            let evaluator = this._hoverEvaluator();
            let firstValue = evaluator.valueForSnapshot(firstSnapshot);
            let secondValue = evaluator.valueForSnapshot(secondSnapshot);
            if (firstValue === secondValue) {
                return ChartDrawMode.Default;
            }

            let gettingBetter = (secondValue < firstValue);
            if (evaluator.upIsBetter) {
                gettingBetter = !gettingBetter;
            }

            return gettingBetter ? ChartDrawMode.Positive : ChartDrawMode.Negative;
        }

        return ChartDrawMode.Default;
    }

    _setHoverPoints(hoverPoints) {
        hoverPoints.sort(function (pointOne, pointTwo) {
            return (pointOne.dataIndex - pointTwo.dataIndex);
        });
        if (this._hoverPointsRequireUpdate(this._hoverPoints, hoverPoints)) {
            this._previousHoverPoints = this._hoverPoints;
            this._hoverPoints = hoverPoints;

            this._drawHoverAnnotations();

            // Only redraw if we're going in or out of a dual-hover state
            if (this._previousHoverPoints.length === 2 || this._hoverPoints.length === 2) {
                this.viz.redraw(false, true); // Don't animate, and don't alter scale for a hover interaction (could happen if some series don't appear during hover)
            }
        }
    }

    _rawBlipWidth() {
        return Math.max(this.renderer.barWidth() * 1.1, 6);
    }

    _rawBlipHeight() {
        return 2.0;
    }

    _hoverEvaluator() {
        return this.averageEvaluator;
    }

    _drawHoverAnnotations() {

        // Step 1: Add highlights if we need them
        while (this._hoverHighlights.length < this._hoverPoints.length) {
            let highlight = new HoverBarHighlight(this.hoverContainer,
                this.displayedAverageDataSeries.evaluator,
                this._rawBlipWidth(),
                this._rawBlipHeight());
            this._hoverHighlights.push(highlight);
        }
        // Step 2: Remove highlights if we have too many
        while (this._hoverHighlights.length > this._hoverPoints.length) {
            let highlight = this._hoverHighlights[0];
            highlight.remove();
            this._hoverHighlights.shift();
        }

        // Step 3: Update highlights to match our hover points
        let hoverPointsToCompare = this._hoverPointsToCompare();
        if (this._hoverPoints.length > 0) {
            let drawMode = this.drawMode();

            // Bar highlights
            let renderer = this.renderer;
            let thisManager = this;
            let averageX = 0;
            this._hoverPoints.forEach(function (hoverPoint, index) {
                let highlight = thisManager._hoverHighlights[index];
                let ySmoothData = thisManager.displayedAverageDataSeries.data[hoverPoint.dataIndex];
                let x = renderer.viewX(hoverPoint.data.normalizedDate()) + 0.5 * renderer.barWidth();
                averageX += x;
                let y = renderer.viewY(ySmoothData[1]);
                let yRange = renderer.viewY.range();
                highlight.setBlipCoordinate(x, y);

                let yRawData = thisManager.displayedDataSeries.data[hoverPoint.dataIndex];
                let yRawCoordinate = renderer.viewY(yRawData[1]);
                highlight.setRawBlipCoordinate(x - 0.5 * thisManager._rawBlipWidth(),
                                               yRawCoordinate - 0.5 * thisManager._rawBlipHeight());
                highlight.setShowRawBlip(hoverPointsToCompare.length < 2);
                highlight.setLineCoordinates(x, yRange[0], x, renderer._visualTopY);
                highlight.setDrawMode(drawMode);
            });
            averageX = averageX / this._hoverPoints.length;

            // Tooltip
            if (this.hoverDescription === null) {
                this.hoverDescription = new HoverView(this.descriptionContainer);
            }

            // Give ourselves the full room to size.
            this.hoverDescription.container.style("left", "0px");
            this.hoverDescription.updateForSnapshots(hoverPointsToCompare.map(p => p.data),
                                                     this.evaluator,
                                                     this.averageEvaluator,
                                                     drawMode);
            let hoverWidth = this.hoverDescription.container.node().offsetWidth;
            let hoverHeight = this.hoverDescription.container.node().offsetHeight;
            let centeredX = (averageX - 0.5 * hoverWidth);
            let xRange = renderer.viewX.range();
            let hoverAboveChartDistance = 8;
            let hoverDescriptionX = Math.min(Math.max(centeredX, xRange[0]), xRange[1] - hoverWidth - 1);
            let hoverDescriptionY = (renderer._visualTopY - (hoverHeight + hoverAboveChartDistance) + renderer.currentCapHeightOffset);
            hoverDescriptionY = Math.max(hoverDescriptionY, this._minHoverY());

            this.hoverDescription.container.style("left", hoverDescriptionX + "px")
                .style("top",  hoverDescriptionY + "px");

        } else if (this.hoverDescription !== null) {
            this.hoverDescription.container.remove();
            this.hoverDescription = null;
        }
    }

    _minHoverY() {
        if (this.hoverBoundsEvaluator === null) {
            return -1000;
        }

        let hoverBoundsY = this.hoverBoundsEvaluator().y;
        let containerInWindowCoordsY = this.descriptionContainer.node().getBoundingClientRect().y;

        return (hoverBoundsY - containerInWindowCoordsY);
    }

    _hoverPointsForTouchPoints(points) {
        let result = [];
        let renderer = this;
        points.forEach(function (point){
            let dataIndex = renderer._dataIndexForPoint(point);
            let data = renderer._snapshotForDataIndex(dataIndex);
            if (data !== null) {
                let hoverPoint = new HoverPoint(dataIndex, data);
                result.push(hoverPoint);
            }
        });
        return result;
    }

    _updateHoverForTouchPoints(points) {
        let hoverPoints = this._hoverPointsForTouchPoints(points);
        this._setHoverPoints(hoverPoints);
    }

    _hasData() {
        return (this.data !== null) && (this.data.length > 0);
    }

    _didStartHover(rect) {
        if (!this._hasData()) {
            return;
        }

        let points = [mouse(rect)];
        let currentTouches = touches(rect);
        this._hoverDidMove = false;

        if (currentTouches.length > 0) {

            if (this._hoverPoints.length === 0) {
                let manager = this;
                setTimeout(function () {
                    manager._initiateHoverAtPoints(currentTouches);
                }, SCRUB_MIN_LINGER_TIME);
            } else {
                this._updateHoverForTouchPoints(currentTouches);
            }
        } else {
            this._initiateHoverAtPoints(points);
        }
    }

    _resetMouseDown() {
        this._mouseDownPoint = null;
        this.hoverTouchRect.style("cursor", "grab");
    }

    _didMouseDown(rect) {
        this.hoverTouchRect.style("cursor", "grabbing");
        this._mouseDownPoint = mouse(rect);
        this._didMoveHover(rect);
    }

    _didMouseUp(rect) {
        this._resetMouseDown();
        this._didMoveHover(rect);
    }

    _initiateHoverAtPoints(points) {
        if (!this._hoverDidMove) {
            this._updateHoverForTouchPoints(points);
        }
    }

    _didMoveHover(rect) {
        if (!this._hasData()) {
            return;
        }

        let points = [mouse(rect)];
        if (this._mouseDownPoint !== null) {
            points.push(this._mouseDownPoint);
        }
        let currentTouches = touches(rect);
        let isTouchBased = (currentTouches.length > 0);
        if (isTouchBased) {
            points = currentTouches;
        }

        this._hoverDidMove = true;
        if (this._hoverPoints.length > 0) {
            this._updateHoverForTouchPoints(points);
            if (isTouchBased) {
                event.preventDefault();
            }
        }
    }

    _didEndHover(rect) {
        if (!this._hasData()) {
            return;
        }

        let currentTouches = touches(rect);

        this._resetMouseDown();

        if (currentTouches.length > 0) {
            this._updateHoverForTouchPoints(currentTouches)
        } else if (this._hoverPoints.length > 0) {
            this._setHoverPoints([]);
        }
    }

    _dayForPoint(point) {
        let normalizedX = point[0] - this.renderer.margin.left;
        let date = this.renderer.viewX.invert(normalizedX);
        let possibleRange = this.renderer.displayedDateRange;
        if (date < possibleRange[0]) {
            date = possibleRange[0];
        } else if (date > possibleRange[1]) {
            date = possibleRange[1];
        }
        return date;
    }

    _dataIndexForPoint(point) {
        let date = this._dayForPoint(point);
        return this._dataIndexForDate(date);
    }

    _dataIndexForDate(date) {
        let numDays = numDaysBetweenDates(this.renderer.displayedDateRange[0], date, false);
        let indexIntoDisplayedData = Math.floor(numDays);
        return indexIntoDisplayedData;
    }

    _snapshotForDataIndex(indexIntoDisplayedData) {
        if (indexIntoDisplayedData < this.data.length && indexIntoDisplayedData >= 0) {
            return this.data[indexIntoDisplayedData];
        }

        console.log("ERROR: no data for index " + indexIntoDisplayedData + ", filtered data size: " + this.data.length);
        return null;
    }

    _snapshotForPoint(point) {
        let index = this._dataIndexForPoint(point);
        return this._snapshotForDataIndex(index);
    }

    _hoverPointForDate(date) {
        let dataIndex = this._dataIndexForDate(date);
        let data = this._snapshotForDataIndex(dataIndex);
        if (data === null) {
            return null;
        }
        return new HoverPoint(dataIndex, data);
    }
}