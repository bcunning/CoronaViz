import { event } from 'd3-selection';
import { geoAlbers, geoPath} from "d3-geo";
import { interpolate } from 'd3-interpolate';
import { zoom, zoomIdentity } from 'd3-zoom';
import * as topojson from 'topojson-client';

import CGRect from "./CGRect.js";

import { MAP_REGION_TRANSITION_DURATION } from "./Constants.js";
import { NATION_DEFAULT_ID } from "./Constants.js";

const MAP_INITIAL_SCALE = 925;
const MAP_ZOOM_RESET_TIMEOUT = 7000;
const MAP_ZOOM_RESET_DURATION = 1500;
const MAP_BACKGROUND_COLOR = "white";
const MAP_ZOOMED_OUT_PADDING_FACTOR = 0.95;

const MAP_MAX_HEIGHT = 150;

const NATION_DEFAULT_FILL = "#ccc";
const NATION_DEFAULT_STROKE_WIDTH = 0.0;
const NATION_DEFAULT_STROKE = "none";

const COUNTY_DEFAULT_FILL = "rgba(255, 0, 0, 0)";
const COUNTY_DEFAULT_STROKE = "none";
const COUNTY_DEFAULT_STROKE_WIDTH = 2.0;
const COUNTY_HOVERED_STROKE = "rgba(255, 255, 255, 1.0)";
const COUNTY_HOVERED_STROKE_WIDTH = 2.0;
const COUNTY_HIGHLIGHTED_STROKE = "rgb(255, 255, 255)";
const COUNTY_HIGHLIGHTED_STROKE_WIDTH = 2.0;

const STATE_DEFAULT_FILL = "rgba(0, 0, 0, 0.0)";
const STATE_DEFAULT_STROKE = "rgba(0, 0, 0, 0.15)";
const STATE_DEFAULT_STROKE_WIDTH = 1.0;
const STATE_HOVERED_STROKE = "rgba(255, 255, 255, 1.0)";
const STATE_HOVERED_STROKE_WIDTH = 2.0;
const STATE_HIGHLIGHTED_STROKE = "rgb(255, 255, 255)";
const STATE_HIGHLIGHTED_STROKE_WIDTH = 2.0;
const STATE_INACTIVE_FILL = "rgba(235, 235, 235, 0.85)";

export const MapHighlightState  = {
    NoHighlight: 0,
    ResettingHighlight: 1,
    SettingHighlight: 2,
    Highlighted: 3
};

export default class MapVisualization {
    constructor(vizWidth, vizHeight, parentElementSelection, countryGeometry, evaluator) {

        // Public variables
        this.desiredWidth = vizWidth;
        this.desiredHeight = vizHeight;
        this.zoomBoxPaddingFactor = 0.7;
        this.maxScale = 50;

        let regionLevels = countryGeometry.objects;
        this.nationFeature = topojson.feature(countryGeometry, regionLevels.nation).features;
        this.setStateFeatures(topojson.feature(countryGeometry, regionLevels.states).features);
        if (regionLevels.counties !== undefined) {
            this.setCountyFeatures(topojson.feature(countryGeometry, regionLevels.counties).features);
        } else {
            this.setCountyFeatures(null);
        }

        this._evaluator = evaluator;

        // Delegate callbacks
        this.onSliderValueChanged = null;
        this.onRegionClicked = null;
        this.onRegionMouseOver = null;
        this.onRegionMouseOut = null;
        this.onOceanClicked = null;
        this.didScrollAwayFromHighlightedState = null;

        // View-state
        this.currentHighlightState = MapHighlightState.NoHighlight;
        this._highlightedRegionID = null;
        this._hoveredRegionID = null;
        this._zoomedBounds = null;
        this.apparentWidth = null;
        this.apparentHeight = null;

        let thisViz = this;

        this._updateZoomFunction(0.5);

        this.mapContainer = parentElementSelection;

        // Create SVG
        this.svg = this.mapContainer.append("svg").attr("class", "map-viz");
        this._updateViewboxForNewDimensions(vizWidth, vizHeight);

        // Install background rect
        this.svg.append("rect")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("fill", MAP_BACKGROUND_COLOR)
            .on("click", function() {
                thisViz._didClickOcean(thisViz); // Clicking on the background will reset it.
            });

        // Geometry layers: state, county, overlay
        this._baseLayer = this.svg.append("g");

        this._nationLayer = this._baseLayer.append("g");
        this._countyLayer = this._baseLayer.append("g").attr("class", "county-layer");
        //this._overlayLayer = this._baseLayer.append("g");
        this._stateLayer = this._baseLayer.append("g").attr("class", "state-layer");

        // Projection setup
        // (To focus NYC: scale 9000, translate[-1.7*vizWidth, 1.4*vizHeight])
        let albersProjection = geoAlbers()
            .scale(MAP_INITIAL_SCALE)
            .translate([0.5 * vizWidth, 0.5 * vizHeight]);

        this._geoPath = geoPath().projection(albersProjection);

        this._initializeFeatures();
        this._createNation(this._nationLayer, this.nationFeature, this._geoPath);
        this._createStates(this._stateLayer, this.stateFeatures, this._geoPath);
        this._createCounties(this._countyLayer, this.countyFeatures, this._geoPath);
        //this._createOverlays(this._countyLayer, this._overlayLayer, this.countyFeatures);

        this._parseDimensions();
        this.resetZoom(false)

        window.addEventListener('resize', function() {
            thisViz.didResize();
        });
    }

    windowBounds() {
        return CGRect.fromSVGRect(this.svg.node().getBoundingClientRect());
    }

    setEvaluator(evaluator) {
        // If the map is displaying change, we need to smooth it over time
        if (evaluator.measureDelta) {
            evaluator = Evaluator.smoothedCopy(evaluator);
        }
        this._evaluator = evaluator;
        this.updateMapForDay(this._currentDay, this._currentData, true);
    }

    resetZoom(animated = true, duration = MAP_REGION_TRANSITION_DURATION) {
        let baseBox = new CGRect(0, 0, this.desiredWidth, this.desiredHeight);
        this.zoomToBox(baseBox, animated, MAP_ZOOMED_OUT_PADDING_FACTOR, duration);
        this._zoomedBounds = null;
    }

    zoomToBox(boundingBox, animated = true, paddingFactor = null, duration = MAP_REGION_TRANSITION_DURATION) {
        const x0 = boundingBox.x;
        const x1 = boundingBox.x + boundingBox.width;
        const y0 = boundingBox.y;
        const y1 = boundingBox.y + boundingBox.height;

        this._zoomedBounds = boundingBox;
        let centerPoint = [(x0 + x1) / 2.0, (y0 + y1) / 2.0];
        let scale = this._scaleForBoundingBox(boundingBox, paddingFactor);

        let thisMap = this;
        let svgSelection = this.svg;
        if (animated) {
            svgSelection = svgSelection.transition().duration(duration);
        }
        svgSelection.call(this._zoom.transform,
            zoomIdentity
                .translate(this.activeWidth / 2, this.activeHeight / 2)
                .scale(scale)
                .translate(-(x0 + x1) / 2, -(y0 + y1) / 2),
            centerPoint)
            .on("end", function () {
                thisMap._finishedZoomTransition();
            });
    }

    _updateZoomFunction(minScale = null) {
        if (minScale === null) {
            let maxMapRect = new CGRect(0, 0, this.desiredWidth, this.desiredHeight);
            minScale = this._scaleForBoundingBox(maxMapRect, MAP_ZOOMED_OUT_PADDING_FACTOR);
        }
        let thisViz = this;
        this._zoom = zoom()
            .scaleExtent([minScale, this.maxScale])
            .interpolate(interpolate)
            .on("zoom", function() {
                thisViz._zoomed(thisViz);
            });

        if (this.svg !== undefined) {
            this.svg.call(this._zoom);
        }
    }

    _scaleForBoundingBox(boundingBox, paddingFactor= null) {
        if (paddingFactor === null) {
            paddingFactor = this.zoomBoxPaddingFactor;
        }
        let limitingRatio = Math.max(boundingBox.width / this.activeWidth, boundingBox.height / this.activeHeight);
        return Math.min(this.maxScale, paddingFactor / limitingRatio);
    }

    boundingBoxForRegion(regionID) {
        const path = this._pathSelectionForRegionID(regionID).node();
        return CGRect.fromSVGRect(path.getBBox());
    }

    boundingBoxForRegions(regionIDs) {
        if (regionIDs.length === 0) {
            return null;
        }

        let thisMap = this;
        let aggregateBox = null;
        regionIDs.forEach(function(regionID){
            let regionBounds = thisMap.boundingBoxForRegion(regionID);
            if (aggregateBox === null) {
                aggregateBox = regionBounds;
            } else {
                aggregateBox.unionRect(regionBounds);
            }
        });

        return aggregateBox;
    }

    setCompactView(isCompact) {
        if (this.isCompact !== isCompact) {
            this.isCompact = isCompact;
            this.svg.attr("compact", isCompact ? "" : null);
        }
    }

    _regionIDsContainState(regionIDs) {
        if (regionIDs === null) {
            return false;
        } else if (regionIDs.length === 0) {
            return false;
        }

        return this._containerLayerForRegionID(regionIDs[0]) === this._stateLayer;
    }

    _regionIDsContainCounty(regionIDs) {
        if (regionIDs === null) {
            return false;
        } else if (regionIDs.length === 0) {
            return false;
        }

        return this._containerLayerForRegionID(regionIDs[0]) === this._countyLayer;
    }

    _regionIDsRepresentNation(regionIDs) {
        // The nation is the default (empty) region
        if (regionIDs === null) {
            return true;
        } else if (regionIDs.length === 0) {
            return true;
        }

        return this._containerLayerForRegionID(regionIDs[0]) === this._nationLayer;
    }

    highlightRegionWithID(regionID) {
        this.highlightRegionsWithIDs(regionID === null ? [] : [regionID]);
    }

    highlightRegionsWithIDs(regionIDs) {
        let isUnhighlighting = this._regionIDsRepresentNation(regionIDs);

        // If we're already not highlighting, bail
        if (isUnhighlighting && this.currentHighlightState <= MapHighlightState.ResettingHighlight) {
            return;
        }

        let isState = this._regionIDsContainState(regionIDs);
        let wasCounty = this._regionIDsContainCounty(this._highlightedRegionID ? [this._highlightedRegionID] : null);
        let isCounty = this._regionIDsContainCounty(regionIDs);
        let isGroup = (regionIDs.length > 1);

        // This update must go before the following update or else it will stomp on the fill transition
        // Prolly some d3 thing where you need to merge transitions instead of creating a new one?
        let regionToStroke = isGroup ? null : regionIDs[0]; // Only highlight singles for now, until we can generate union convex path (prolly not worth it)
        this._setHighlightedRegionWithID(regionToStroke, !(wasCounty && isCounty)); // Don't animate if we're moving between counties

        if (isState || isUnhighlighting) {
            let thisMap = this;
            let targetRegionIDs = new Set(regionIDs);

            thisMap._stateLayer.style("pointer-events", isUnhighlighting ? "all" : "none");
            thisMap.currentHighlightState =  isUnhighlighting ? MapHighlightState.ResettingHighlight : MapHighlightState.SettingHighlight;

            this._stateLayer.selectAll("path.statePath")
                .transition().duration(MAP_REGION_TRANSITION_DURATION)
                .attr("fill", function (currentFeature) {
                    let isActive = isUnhighlighting || targetRegionIDs.has(currentFeature.id);
                    return isActive ? STATE_DEFAULT_FILL : STATE_INACTIVE_FILL;
                })
                .attr("stroke", feature => this._strokeForRegionID(feature.id))
                .attr("stroke-width", feature => this._strokeWidthForRegionID(feature.id))
                .style("pointer-events", function (currentFeature) {
                    // If we're selecting a single state, turn off pointer-events to allow counties to become clickable.
                    // Otherwise allow the individual states of a group to remain clickable.
                    let isSelectedRegion = targetRegionIDs.has(currentFeature.id);
                    return (isSelectedRegion && !isGroup) ? "none" : "all";
                })
                .on("end", function() {
                    thisMap.currentHighlightState = isUnhighlighting ? MapHighlightState.NoHighlight : MapHighlightState.Highlighted;
                });
        } else {
            // If we changed fill parameters or pointer behavior for counties, this is where we'd do it
        }
    }

    _containerLayerForRegionID(regionID) {
        if (this._stateRegions.has(regionID)) {
            return this._stateLayer;
        } else if (this._countyRegions.has(regionID)) {
            return this._countyLayer;
        } else if (this._nationRegions.has(regionID)) {
            return this._nationLayer;
        }

        return null;
    }

    _pathSelectionForRegionID(regionID) {
        let containerLayer = this._containerLayerForRegionID(regionID);
        return containerLayer.select("path[regionID=" + MapVisualization.pathRegionID(regionID) + "]");
    }

    _updateStrokeForRegionID(regionID, moveToFront = false, animated = false) {
        if (regionID) {
            let pathSelection = this._pathSelectionForRegionID(regionID);
            if (moveToFront) {
                pathSelection.moveToFront();
            }
            if (animated) {
                pathSelection = pathSelection.transition().duration(MAP_REGION_TRANSITION_DURATION);
            }
            let newStroke = this._strokeForRegionID(regionID);
            let appliedStroke = (newStroke === "none") ? "rgba(0,0,0,0)" : newStroke;
            pathSelection.attr("stroke", appliedStroke)
                .attr("stroke-width", this._strokeWidthForRegionID(regionID));
        }
    }

    _setHighlightedRegionWithID(regionID, animated = false) {
        let previousHighlightedRegionID = this._highlightedRegionID;
        this._highlightedRegionID = regionID;

        // Highlight state supersedes hover state
        if (this._hoveredRegionID === regionID) {
            this._hoveredRegionID = null;
        }

        this._updateStrokeForRegionID(previousHighlightedRegionID, false, animated);
        this._updateStrokeForRegionID(regionID, true, animated);
    }

    hoverRegionWithID(regionID, animated = false) {
        // Block county hover changes while we're in a highlight transition
        if (this.currentHighlightState > MapHighlightState.NoHighlight
            && this.currentHighlightState < MapHighlightState.Highlighted
            && this._containerLayerForRegionID(regionID) === this._countyLayer) {
            return;
        }

        let previousHoveredRegionID = this._hoveredRegionID;
        this._hoveredRegionID = regionID;

        this._updateStrokeForRegionID(previousHoveredRegionID, false, animated);
        this._updateStrokeForRegionID(regionID, true, animated);

        // Keep the highlighted region front and center
        if (regionID && this._highlightedRegionID) {
            let hoverContainer = this._containerLayerForRegionID(regionID);
            let highlightContainer = this._containerLayerForRegionID(this._highlightedRegionID);
            if (hoverContainer === highlightContainer) {
                this._pathSelectionForRegionID(this._highlightedRegionID).moveToFront();
            }
        }

        this._registerInteraction();
    }

    _strokeWidthForRegionID(regionID) {
        let isState = (this._containerLayerForRegionID(regionID) === this._stateLayer);
        let isCounty = (this._containerLayerForRegionID(regionID) === this._countyLayer);
        let isHovered = (regionID === this._hoveredRegionID);
        let isHighlighted = (regionID === this._highlightedRegionID);

        if (isState) {
            if (isHighlighted) {
                return STATE_HIGHLIGHTED_STROKE_WIDTH;
            }
            if (isHovered) {
                return STATE_HOVERED_STROKE_WIDTH;
            }
            return STATE_DEFAULT_STROKE_WIDTH;
        }
        if (isCounty) {
            if (isHighlighted) {
                return COUNTY_HIGHLIGHTED_STROKE_WIDTH;
            }
            if (isHovered) {
                return COUNTY_HOVERED_STROKE_WIDTH;
            }
            return COUNTY_DEFAULT_STROKE_WIDTH;
        }

        return NATION_DEFAULT_STROKE_WIDTH;
    }

    _strokeForRegionID(regionID) {
        let isState = (this._containerLayerForRegionID(regionID) === this._stateLayer);
        let isCounty = (this._containerLayerForRegionID(regionID) === this._countyLayer);
        let isHovered = (regionID === this._hoveredRegionID);
        let isHighlighted = (regionID === this._highlightedRegionID);

        if (isState) {
            if (isHighlighted) {
                return STATE_HIGHLIGHTED_STROKE;
            }
            if (isHovered) {
                return STATE_HOVERED_STROKE;
            }
            return STATE_DEFAULT_STROKE;
        }
        if (isCounty) {
            if (isHighlighted) {
                return COUNTY_HIGHLIGHTED_STROKE;
            }
            if (isHovered) {
                return COUNTY_HOVERED_STROKE;
            }
            return COUNTY_DEFAULT_STROKE;
        }

        return NATION_DEFAULT_STROKE;
    }

    _impliedBoundsFromTransform(transform) {
        let x0 = -transform.x / transform.k;
        let x1 = x0 + this.activeWidth / transform.k;
        let y0 = -transform.y / transform.k
        let y1 = y0 + this.activeHeight / transform.k;
        return new CGRect(x0, y0, x1 - x0, y1 - y0);
    }

    _parseDimensions() {

        let oldWidth = this.apparentWidth;
        this.apparentWidth = parseInt(this.mapContainer.style('width'));

        if (this.apparentWidth === oldWidth) {
            return;
        }

        let fullAspectHeight = this.apparentWidth * (this.desiredHeight / this.desiredWidth);
        this.apparentHeight = Math.min(fullAspectHeight, MAP_MAX_HEIGHT);

        let desiredAspect = (this.desiredWidth / this.desiredHeight);
        let constrainedAspect = (this.apparentWidth / this.apparentHeight);

        if (constrainedAspect > desiredAspect) {
            let newHeight = this.desiredWidth / constrainedAspect;
            this._updateViewboxForNewDimensions(this.desiredWidth, newHeight);
        } else if (this.activeHeight !== this.desiredHeight) {
            this._updateViewboxForNewDimensions(this.desiredWidth, this.desiredHeight);
        }

        this._updateZoomFunction();
    }

    _updateViewboxForNewDimensions(newWidth, newHeight) {
        this.svg.attr("viewBox", [0, 0, newWidth, newHeight]);
        this.activeWidth = newWidth;
        this.activeHeight = newHeight;
    }

    didResize() {
        this._parseDimensions();
    }

    _mapDimensionFromApparentDimension(apparentDimension, transform) {
        return apparentDimension * (1.0 / transform.k) * (this.activeWidth / this.apparentWidth);
    }

    _zoomed(thisViz) {
        // Set base transform
        const {transform} = event;
        thisViz._baseLayer.attr("transform", transform);

        // Parse dimensions if we haven't yet
        if (thisViz.apparentWidth === null) {
            thisViz._parseDimensions();
        }

        // Check to see if we've scrolled away from our highlighted region
        if ((thisViz.currentHighlightState === MapHighlightState.Highlighted)
            && (thisViz.didScrollAwayFromHighlightedState != null)
            && (thisViz._zoomedBounds != null)) {

            let originalBounds = thisViz._zoomedBounds;
            let currentBounds = thisViz._impliedBoundsFromTransform(transform);
            let widthBound = (originalBounds.aspectRatio() > currentBounds.aspectRatio());
            let scaleRatio = widthBound ? (currentBounds.width / originalBounds.width)
                                        : (currentBounds.height / originalBounds.height);

            let zoomedOutEnough = scaleRatio > 2.5;

            let horizontalMargin = 0.25 * thisViz.apparentWidth;
            let verticalMargin = 0.25 * thisViz.apparentHeight;
            let mapHorizontalMargin = thisViz._mapDimensionFromApparentDimension(horizontalMargin, transform);
            let mapVerticalMargin = thisViz._mapDimensionFromApparentDimension(verticalMargin, transform);

            let scrolledTopBelow = currentBounds.top() + mapVerticalMargin > originalBounds.bottom();
            let scrolledBottomAbove = currentBounds.bottom() - mapVerticalMargin < originalBounds.top()
            let scrolledLeftToTheRight = currentBounds.left() + mapHorizontalMargin > originalBounds.right();
            let scrolledRightToTheLeft = currentBounds.right() - mapHorizontalMargin < originalBounds.left();
            let scrolledEnough = (scrolledTopBelow || scrolledBottomAbove || scrolledLeftToTheRight || scrolledRightToTheLeft);

            if (scrolledEnough || zoomedOutEnough) {
                thisViz._zoomedBounds = null;
                thisViz.didScrollAwayFromHighlightedState();
                thisViz._resetZoomAfterDelay()
            }
        }

        this._registerInteraction();
    }

    _registerInteraction() {
        if (this.currentHighlightState === MapHighlightState.NoHighlight) {
            this.lastInteractionTime = performance.now();
        }
    }

    _resetZoomIfNecessary() {
        if (this.currentHighlightState === MapHighlightState.NoHighlight) {
            // If we've lingered on a hovered region, we're still interacting. Try again later.
            if (this._hoveredRegionID !== null) {
                this._resetZoomAfterDelay(MAP_ZOOM_RESET_TIMEOUT);
                return;
            }

            let timeSinceLastInteraction = performance.now() - this.lastInteractionTime;
            let timeoutDurationRemaining = MAP_ZOOM_RESET_TIMEOUT - timeSinceLastInteraction;
            if (timeoutDurationRemaining > 100) { // Provide a small buffer to account for imprecise callback scheduling of setTimeout
                this._resetZoomAfterDelay(timeoutDurationRemaining);
            } else {
                this.resetZoom(true, MAP_ZOOM_RESET_DURATION);
            }
        }
    }

    _resetZoomAfterDelay(delayInMS = MAP_ZOOM_RESET_TIMEOUT) {
        let thisViz = this;
        setTimeout(function() { thisViz._resetZoomIfNecessary(); }, delayInMS);
    }

    _finishedZoomTransition() {
        // This may be useful at some point
    }

    _initializeFeatures() {
        // Fudge this one for now, the nation feature doesn't come with an ID for some reason
        this._nationRegions = new Set();
        this._nationRegions.add(NATION_DEFAULT_ID);
    }

    setStateFeatures(features) {
        this.stateFeatures = features;
        this._stateRegions = new Set();

        if (features !== null) {
            let thisViz = this;
            features.forEach(function (d) {
                thisViz._stateRegions.add(d.id);
            });
        }
    }

    setCountyFeatures(features) {
        this.countyFeatures = features;
        this._countyRegions = new Set();

        if (features !== null) {
            let thisViz = this;
            features.forEach(function (d) {
                thisViz._countyRegions.add(d.id);
            });
        }
    }

    updateForCountryGeometry(countryGeometry) {
        let regionLevels = countryGeometry.objects;
        if (regionLevels.counties !== undefined) {
            let wasEmpty = (this.countyFeatures === null);
            this.setCountyFeatures(topojson.feature(countryGeometry, regionLevels.counties).features);
            if (wasEmpty) {
                this._createCounties(this._countyLayer, this.countyFeatures, this._geoPath);
            }
        } else {
            this.setCountyFeatures(null);
        }
    }

    // Creating elements

    _createNation(containerLayer, features, geoPath) {
        containerLayer.selectAll("path")
            .data( features )
            .enter()
            .append("path")
            .attr("fill",  NATION_DEFAULT_FILL)
            .attr("stroke-width", NATION_DEFAULT_STROKE_WIDTH)
            .attr("stroke", NATION_DEFAULT_STROKE)
            .attr("vector-effect", "non-scaling-stroke")
            .attr("regionID", function(currentFeature) {
                return MapVisualization.pathRegionID(currentFeature.id);
            })
            .attr("d", geoPath);
    }

    _createStates(containerLayer, features, geoPath) {
        if (features === null) {
            return;
        }

        let thisViz = this;
        containerLayer.selectAll("path")
            .data( features )
            .enter()
            .append("path")
            .attr("class", "statePath")
            .attr("fill",  STATE_DEFAULT_FILL)
            .attr("stroke", d => thisViz._strokeForRegionID(d.id))
            .attr("stroke-width", d => thisViz._strokeWidthForRegionID(d.id))
            .attr("vector-effect", "non-scaling-stroke")
            .attr("regionID", function(currentFeature) {
                return MapVisualization.pathRegionID(currentFeature.id);
            })
            .attr( "d", geoPath )
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
    }

    _createCounties(containerLayer, features, geoPath) {
        if (features === null) {
            return;
        }

        let thisViz = this;
        containerLayer.selectAll("path")
            .data( features )
            .enter()
            .append("path")
            .attr("class", "countyPath")
            .attr("fill", COUNTY_DEFAULT_FILL)
            .attr( "stroke", COUNTY_DEFAULT_STROKE)
            .attr( "stroke-width", COUNTY_DEFAULT_STROKE_WIDTH)
            .attr("vector-effect", "non-scaling-stroke")
            .attr( "regionID", function(currentFeature) {
                return MapVisualization.pathRegionID(currentFeature.id);
            })
            .attr( "d", geoPath )
            .on("mouseover", function(currentFeature) {
                thisViz._didMouseOverRegion(thisViz, this, currentFeature);
            })
            .on("mouseout", function(currentFeature) {
                thisViz._didMouseOutRegion(thisViz, this, currentFeature);
            })
            .on("click", function(currentFeature) {
                thisViz._didClickRegion(thisViz, this, currentFeature);
            });
    }

    _createOverlays(countyContainerLayer, overlayContainerLayer, features) {
        let thisViz = this;
        overlayContainerLayer.selectAll("circle")
            .data(features)
            .enter()
            .append("circle")
            .attr("display", "none")
            .attr("regionID", function (currentFeature){
                return MapVisualization.pathRegionID(currentFeature.id)
            } )
            .attr("cx", function (currentFeature){
                let boundingBox = thisViz.boundingBoxForRegion(currentFeature.id);
                return (boundingBox.x + 0.5*boundingBox.width).toString();
            } )
            .attr("cy", function (currentFeature){
                let boundingBox = thisViz.boundingBoxForRegion(currentFeature.id);
                return (boundingBox.y + 0.5*boundingBox.height).toString();
            } )
            .attr("stroke", "red")
            .attr("stroke-width", "1.0")
            .attr("fill", "rgba(255, 0, 0, 0.05)")
            .attr("r", "1.0");
    }

    // Update
    updateMapForDay(day, countyData, animated) {
        this._currentDay = day;
        this._currentData = countyData;

        this._updateCountiesForDay(day, countyData, animated);
        //this._updateOverlaysForDay(day, dataByCountyName, animated);
    }

    _updateCountiesForDay(day, countyData, animated) {
        let selection = this._countyLayer.selectAll( "path.countyPath" );
        if (animated) {
            selection = selection.transition().duration(MAP_REGION_TRANSITION_DURATION);
        }
        let thisViz = this;
        selection.attr( "fill", function(county) {
            let countyOnThisDay = countyData.dataForRegionOnDay(county.id, day);
            if (countyOnThisDay !== null && countyOnThisDay !== undefined) {
                let intensity = thisViz._evaluator.intensityForSnapshot(countyOnThisDay);
                if (intensity !== 0) {
                    return thisViz._evaluator.colorForIntensity(intensity);
                }
            }
            return COUNTY_DEFAULT_FILL;
        });
    }

    _updateOverlaysForDay(day, dataByCountyID, animated) {
        let selection = this._overlayLayer.selectAll("circle");
        if (animated) {
            selection = selection.transition().duration(300);
        }

        let thisViz = this;
        selection.attr( "r", function(county) {
            let currentCountyID = county.id;
            let countyOnThisDay = dataByCountyID.get(currentCountyID);
            if (countyOnThisDay) {
                let intensity = thisViz._evaluator.intensityForSnapshot(countyOnThisDay);

                if (intensity >= 0.0) {
                    let minRadius = 1.0;
                    let maxRadius = 20.0;

                    let radius = minRadius + (maxRadius - minRadius)*intensity;

                    return radius.toString();
                }
            }

            // Null-op
            return this.attributes.r.value;

        }).attr("display", function(county){
            let currentCountyID = county.id;
            let countyOnThisDay = dataByCountyID.get(currentCountyID);
            if (countyOnThisDay) {
                let currentValue = thisViz._evaluator.valueForSnapshot(countyOnThisDay);
                if (currentValue >= 0.0) {
                    return "initial";
                }
            }

            return "none";
        });
    }

    // Interaction callbacks

    _didMouseOverRegion(thisViz, path, feature) {
        if (thisViz.onRegionMouseOver) {
            thisViz.onRegionMouseOver(feature.id);
        }
    }

    _didMouseOutRegion(thisViz, path, feature) {
        if (thisViz.onRegionMouseOut) {
            thisViz.onRegionMouseOut(feature.id);
        }
    }

    _didClickRegion(thisViz, path, feature) {
        // console.log("clicked region: " + feature.properties.name + " with ID: " + feature.id);
        if (thisViz.onRegionClicked) {
            thisViz.onRegionClicked(feature.id);
        }
    }

    _didClickOcean(thisViz) {
        if (thisViz.onOceanClicked) {
            thisViz.onOceanClicked();
        }
    }

    static pathRegionID(countyID) {
        return "region" + countyID;
    }
}