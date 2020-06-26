import { format } from 'd3-format';
import { timer } from "d3-timer";

import CGRect from "./CGRect.js";
import DataTable from "./DataTable.js";
import DateSlider from "./DateSlider.js";
import EvaluatorLibrary from "./EvaluatorLibrary.js";
import Infection from "./Infection.js";
import MapVisualization from "./MapVisualization.js";
import MobilityEvaluator from "./MobilityEvaluator.js";
import OverTimeVisualization from "./OverTimeVisualization.js";
import RankedBarVisualization from "./RankedBarVisualization.js";
import RegionPicker from "./RegionPicker.js";
import RegionPickerSection from "./RegionPickerSection.js";
import SliderGradientStop from "./SliderGradientStop.js";
import Stat from "./Stat.js";
import StatDashboard from "./StatDashboard.js";
import VizHeader from "./VizHeader.js";

import { NATION_DEFAULT_ID } from "./Constants.js";
import OverTimeSeries from "./OverTimeSeries";
import {RegionType} from "./Region";
import TableConfigurationView from "./TableConfigurationView";

const MAP_VIZ_WIDTH = 900;
const MAP_VIZ_HEIGHT = 450;

const RANKED_BAR_VIZ_WIDTH = 600;
const RANKED_BAR_VIZ_HEIGHT = 400;

const HEADER_COLLAPSE_SCROLL_DISTANCE = 20.0;

const MS_PER_DAY = 400.0;

export default class VizController {
    constructor(parentElementSelection,
                countyInfectionData,
                stateInfectionData,
                nationInfectionData,
                coalitionInfectionData,
                nationRegion,
                countryGeometry) {

        this.firstDay = "2020-03-04";
        this.baseRegion = nationRegion;
        this._nextRegionQueue = [];
        this.didSelectCounty = null;
        const thisController = this;

        this.setNationData(nationInfectionData);
        this.setCoalitionData(coalitionInfectionData);
        this.setStateData(stateInfectionData);
        this.setCountyData(countyInfectionData);

        let dateRange = [this.nationInfectionData.firstDay, this.nationInfectionData.lastDay];

        // This spacer always needs to be the first thing added to parentElementSelection
        this.headerSpacer = parentElementSelection.append("div").attr("class", "header-spacer");
        this.slider = null;//new DateSlider(parentElementSelection, dateRange, EvaluatorLibrary.nationalCaseSliderEvaluator());
        this.statDashboard = new StatDashboard(parentElementSelection, this._coreStatsForSnapshot(null));
        this.tableConfiguration = new TableConfigurationView(parentElementSelection, dateRange);
        this.tableConfiguration.didUpdateEvaluators = function (newEvaluators) {
            let sortEvaluator = thisController.tableConfiguration.sortEvaluator();
            let tableSupportsNewEvaluator = sortEvaluator.supportsRegionType(thisController.dataTable.childRegionType());
            let currentSelectionIsDisplayed = thisController.dataTable.highlightedRegionID === thisController.selectedRegionID;
            let needsDataUpdate = !tableSupportsNewEvaluator || !currentSelectionIsDisplayed;
            thisController.dataTable.updateForEvaluators(newEvaluators, sortEvaluator, false, needsDataUpdate);
            if (needsDataUpdate) {
                thisController.updateDataTable(false);
            }
        }
        this.dataTable = new DataTable(parentElementSelection, this.tableConfiguration.currentEvaluators(), this.tableConfiguration.sortEvaluator());

        let overTimeEvaluators = this._overTimeEvaluators();
        this.overTimeCharts = [];

        overTimeEvaluators.forEach(function (evaluator) {
            let newChart = new OverTimeVisualization(parentElementSelection, evaluator);
            newChart.fixTimeDomain(dateRange[0], dateRange[1]);
            thisController.overTimeCharts.push(newChart);
        });

        let rankedBarEvaluators = this._rankedBarChartEvaluators();
        this.rankedBarCharts = [];
        rankedBarEvaluators.forEach(function (evaluator) {
            let newChart = new RankedBarVisualization(RANKED_BAR_VIZ_WIDTH,
                RANKED_BAR_VIZ_HEIGHT,
                parentElementSelection,
                evaluator);
            thisController.rankedBarCharts.push(newChart);
        });

        this.interactiveElements = [this.dataTable].concat(this.overTimeCharts).concat(this.rankedBarCharts);

        this.attributionDetails = this._pageAttribution(parentElementSelection);

        // This must be the final (non-floating) element appended to parentElementSelection
        this.footerSpacer = parentElementSelection.append("div").attr("class", "footer-spacer");

        this._regionPickerActive = false;

        // Header Components
        this.headerContainer = parentElementSelection.append("div").attr("class", "fixed-header-summary");
        this.header = new VizHeader(this.headerContainer, this._regionMenuGroups(), dateRange);
        if (this.header.compactTrendLine !== undefined) {
            this.overTimeCharts.unshift(this.header.compactTrendLine);
        }

        this.map = new MapVisualization(MAP_VIZ_WIDTH,
                                        MAP_VIZ_HEIGHT,
                                        this.headerContainer,
                                        countryGeometry,
                                        EvaluatorLibrary.confirmedCaseEvaluator());

        this.header.setFeaturedCollapseElement(this.map);

        // Footer components
        this.footerContainer = parentElementSelection.append("div").attr("class", "fixed-control");
        this.regionPicker = null;//new RegionPicker(this.footerContainer, this._regionSections());

        this._updateFixedRegionSpacing();

        // View-state
        this.selectedRegionID = nationRegion.ID;
        this.hoveredRegionID = null;
        this.lastWindowWidthUpdate = window.outerWidth;

        this.updateSlider();

        // Callbacks
        window.addEventListener('resize', function() {
            thisController.didResize();
        });
        window.addEventListener('scroll', function() {
            thisController.didScroll(this);
        })

        // Set day based on slider updates
        if (this.slider !== null) {
            this.slider.onSliderValueChanged = function(newSliderValue) {
                thisController.pause();
                const newDay = thisController.nationInfectionData.dayForPercentElapsed(newSliderValue);
                thisController.setDay(newDay, false);
            };
        }


        // Clicks

        // When a region is clicked, feature it. If it's already featured, reset to previous region (if there is one)
        this.map.onRegionClicked = function(regionID) {
            thisController._vizClickedRegionID(regionID, thisController.map);
        };

        this.header.onRegionSelected = function(regionID) {
            thisController._vizClickedRegionID(regionID, thisController.header);
        }
        this.header.onDateChanged = function (dateString) {
            thisController.setDay(dateString, true);
        }
        this.header.didClickBackButton = function() {
            let currentRegion = thisController._currentRegion();
            let nextRegion = (currentRegion.parentRegion !== null) ? currentRegion.parentRegion : thisController.baseRegion;
            thisController._vizClickedRegionID(nextRegion.ID, thisController.header);
        }

        this.dataTable.onRegionClicked = function(regionID) {
            thisController._vizClickedRegionID(regionID, thisController.dataTable);
        }

        this.overTimeCharts.forEach(function (chart) {
            if (chart.title !== null) {
                chart.title.didTapRegionDescription = function (region) {
                    thisController._vizClickedRegionID(region.ID, chart);
                };
            }
            chart.hoverBoundsEvaluator = function () {
                return thisController.currentHoverBounds();
            }
        });
        this.rankedBarCharts.forEach(function (chart) {
            if (chart.title !== null) {
                chart.title.didTapRegionDescription = function (region) {
                    thisController._vizClickedRegionID(region.ID, chart);
                };
            }
            chart.onRegionClicked = function (regionID){
                thisController._vizClickedRegionID(regionID, chart);
            };
            chart.onRegionMouseOver = function(regionID) {
                thisController.setHoveredRegion(regionID);
            };
            chart.onRegionMouseOut = function(regionID) {
                thisController.setHoveredRegion(null);
            };
        })

        // Hovers
        this.map.onRegionMouseOver = function(regionID) {
            // console.log("mouseover region: " + regionID);
            thisController.setHoveredRegion(regionID);
        };

        this.map.onRegionMouseOut = function(regionID) {
            //console.log("mouseout region: "+ regionID);
            thisController.setHoveredRegion(null);
        };

        this.map.onOceanClicked = function() {
            thisController.unsetRegion(true);
        };

        this.map.didScrollAwayFromHighlightedState = function() {
            console.log("Did scroll away from highlighted state");
            thisController.unsetRegion(false);
        };

        this.collapsed = false;
        this.lastScrollOffset = 0;
        this.didScroll(window, false);
    }

    floatingHeaderBottomY() {
        let mapBounds = this.map.windowBounds();
        return mapBounds.y + mapBounds.height;
    }

    currentHoverBounds() {
        let windowRect = new CGRect(0, 0, window.innerWidth, window.innerHeight);
        let topHoverBounds = this.floatingHeaderBottomY() + 8;
        return new CGRect(windowRect.x, topHoverBounds, windowRect.width, windowRect.height - topHoverBounds);
    }

    currentlyFocusedChartElement() {
        // Return the first chart to appear below the floating header
        let visibleY = this.floatingHeaderBottomY();
        for(let i = 0; i < this.interactiveElements.length; i++) {
            let chart = this.interactiveElements[i];
            let chartElement = chart.container.node();
            let chartTopY = chartElement.getBoundingClientRect().y;
            if (chartTopY >= visibleY) {
                return chartElement;
            }
        }
        return null;
    }

    chartIsVisible(chart) {
        let chartElement = chart.container.node();
        let containerRect = CGRect.fromSVGRect(chartElement.getBoundingClientRect());
        let visibleRect = this.currentHoverBounds();
        let isTopVisible = containerRect.top() > visibleRect.top() && containerRect.top() < visibleRect.bottom();
        let isBottomVisible = containerRect.bottom() > visibleRect.top() && containerRect.bottom() < visibleRect.bottom();
        return isTopVisible || isBottomVisible;
    }

    setNationData(timeSeries) {
        if (timeSeries) {
            this.nationInfectionData = timeSeries.timeSeriesBeginningAt(this.firstDay);
        } else {
            this.nationInfectionData = null;
        }
    }

    setCoalitionData(timeSeries) {
        if (timeSeries) {
            this.coalitionInfectionData = timeSeries.timeSeriesBeginningAt(this.firstDay);
            this.enqueueTopRegions();
        } else {
            this.coalitionInfectionData = null;
        }
    }

    setStateData(timeSeries) {
        if (timeSeries) {
            this.stateInfectionData = timeSeries.timeSeriesBeginningAt(this.firstDay);
            if (this.currentDay !== undefined) {
                if (this.header !== undefined) {
                    this.header.updateForOptions(this._regionMenuGroups());
                }
                if (this.regionPicker !== undefined && this.regionPicker !== null) {
                    this.regionPicker.updateForRegionSections(this._regionSections());
                }

                this.updateRankedChartForDay(this.currentDay, false);
                this.updateDashboard(false);
                this.updateDataTable(false);
            }
        } else {
            this.stateInfectionData = null;
        }
    }

    setCountyData(timeSeries) {
        if (timeSeries) {
            this.countyInfectionData = timeSeries.timeSeriesBeginningAt(this.firstDay);
            if (this.map !== undefined) {
                this.updateMapForDay(this.currentDay, true);
            }
        } else {
            this.countyInfectionData = null;
        }
    }

    updateCountryGeometry(countryGeomery) {
        this.map.updateForCountryGeometry(countryGeomery)
    }

    updateMobilityChart() {
        // For now just grab the last one.
        let mobilityChart = this.overTimeCharts.last();
        let dataSlice = this.currentOverTimeDataSlice(this.currentDay);
        this.updateOverTimeChart(mobilityChart, this.currentDay, this._currentRegion(), dataSlice, true);
    }

    didResize() {
        let currentWidth = window.outerWidth;
        if (currentWidth !== this.lastWindowWidthUpdate) {
            this.header.resetHeaderHeight();
            this._updateFixedRegionSpacing();
            this.lastWindowWidthUpdate = currentWidth;
        }
    }

    didScroll(scrolledWindow, animate = true) {
        let scrollOffset = scrolledWindow.scrollY;
        let wasAtTop = this.lastScrollOffset < HEADER_COLLAPSE_SCROLL_DISTANCE;
        let isAtTop = scrollOffset < HEADER_COLLAPSE_SCROLL_DISTANCE;

        if (wasAtTop && !isAtTop) {
            this.setHeaderCollapsed(true, animate);
        } else if (this.collapsed && scrollOffset <= 0) {
            this.setHeaderCollapsed(false, animate);
        }

        this.lastScrollOffset = scrollOffset;
    }

    enqueueTopRegions() {
        if (this.coalitionInfectionData !== null) {
            this._nextRegionQueue = this.coalitionInfectionData.topRegions();
        }
    }

    resetRegionQueue() {
        this._nextRegionQueue = [];
    }

    popNextRegion() {
        return this._nextRegionQueue.shift();
    }

    setHeaderCollapsed(collapsed, animated) {
        if (this.collapsed !== collapsed) {

            this.collapsed = collapsed;
            this.headerContainer.attr("compact", collapsed ? "" : null);
            this.header.setCollapsed(collapsed, animated);
            this.map.setCompactView(collapsed);
        }
    }

    _overTimeEvaluators() {
        return [EvaluatorLibrary.newConfirmedCaseEvaluator(),
                EvaluatorLibrary.newDeathEvaluator(),
                EvaluatorLibrary.currentlyHospitalizedEvaluator(),
                EvaluatorLibrary.newTestBreakdownEvaluator(),
                EvaluatorLibrary.newTestPercentPositiveEvaluator(),
                MobilityEvaluator.mobilityDataEvaluator()];
    }

    _rankedBarChartEvaluators() {
        return [EvaluatorLibrary.newConfirmedCaseEvaluator(),
                EvaluatorLibrary.newDeathEvaluator()];
    }

    _setRegionPickerActive(isActive) {
        if (this._regionPickerActive !== isActive && this.regionPicker !== null) {
            this._regionPickerActive = isActive;
            this.footerContainer.attr("active", isActive ? "" : null);
            this._updateFixedRegionSpacing();
        }
    }

    _updateFixedRegionSpacing() {
        // Fix scroll sizing so that floating header and footer don't obscure any content
        let headerOffsetHeight = this.headerContainer.node().offsetHeight;
        this.headerSpacer.style("height", headerOffsetHeight + "px");
        let footerOffsetHeight = this._regionPickerActive ? this.footerContainer.node().offsetHeight : 0;
        this.footerSpacer.style("height", footerOffsetHeight + "px");
    }

    _regionMenuGroups() {
        let result = new Map();
        result.set("Country", [this.baseRegion]);
        if (this.coalitionInfectionData !== null) {
            result.set("Regions", this.coalitionInfectionData.topRegions());
        }
        if (this.stateInfectionData !== null) {
            result.set("States", this.stateInfectionData.topRegions(0, null, EvaluatorLibrary.regionNameEvaluator(), true));
        }

        // Counties should be in the menu if the current region is a county or a state
        let currentRegion = this._currentRegion();
        if (currentRegion !== null && this.countyInfectionData !== null) {
            let isState = this._regionIsState(currentRegion.ID);
            let isCounty = this._regionIsCounty(currentRegion.ID);
            if (isState || isCounty) {
                let parentRegion = isState ? currentRegion : currentRegion.parentRegion;
                let counties = this.countyInfectionData.topRegions(0, function (snapshot) {
                        if (snapshot.region.parentRegion !== null) {
                            return (snapshot.region.parentRegion.ID === parentRegion.ID);
                        }
                        return false;
                    },
                    EvaluatorLibrary.regionNameEvaluator(),
                    true
                );
                result.set(parentRegion.name + " Counties", counties);
            }
        }

        return result;
    }

    _regionSections() {
        let result = [];

        let majorRegions = [this.baseRegion];
        if (this.coalitionInfectionData !== null) {
            let coalitionRegions = this.coalitionInfectionData.topRegions();
            majorRegions = majorRegions.concat(coalitionRegions);
        }
        result.push(new RegionPickerSection("Regions", majorRegions));

        if (this.stateInfectionData !== null) {
            let continentalStatesFilter = function(snapshot) { return snapshot.region.ID <= "56"; };
            let topStates = this.stateInfectionData.topRegions(8, continentalStatesFilter);
            result.push(new RegionPickerSection("Top states, by confirmed cases", topStates));

            let bottomStates = this.stateInfectionData.topRegions(8, continentalStatesFilter, EvaluatorLibrary.confirmedCaseEvaluator(), true);
            result.push(new RegionPickerSection("States with fewest cases", bottomStates),);
        }

        return result;
    }

    _currentInfectionSnapshot() {
        let dataset = this._currentDataset();
        let day = this.currentDay;
        let snapshotsByRegionID = dataset.dataForDay(day);
        let regionID = this.selectedRegionID ? this.selectedRegionID : this.baseRegion.ID;
        return snapshotsByRegionID.get(regionID);
    }

    _coreStatsForSnapshot(infectionSnapshot) {
        let infection = infectionSnapshot ? infectionSnapshot.infection : Infection.NullInfection();
        let formatter = format(",");
        let result = [];
        // result.push(new Stat("New Cases", infection.cases ? formatter(infection.cases.change) : "N/A"));
        // result.push(new Stat("New Deaths", infection.deaths ? formatter(infection.deaths.change) : "N/A"));
        // result.push(new Stat("Total Tests", infection.totalTests ? formatter(infection.totalTests.value) : "N/A"));
        // result.push(new Stat("Percent Positive", infection.percentPositive()));
        result.push(new Stat("Total Cases", infection.cases ? formatter(infection.cases.value) : "N/A"));
        result.push(new Stat("Deaths", infection.deaths ? formatter(infection.deaths.value) : "N/A"));

        return result;
    }

    _elementSupportsRepeatedSelection(element, regionID) {
        if (element === this.dataTable) {
            return (regionID !== this.dataTable.aggregateRegionID)
                && (regionID === this.dataTable.highlightedRegionID)
                && !this._regionIsCounty(regionID);
        }

        return false;
    }

    _elementRequiresUpdateForRegion(element, tappedRegionID) {
        if (element === this.dataTable) {
            return (tappedRegionID === this.dataTable.highlightedRegionID);
        }
        return true;
    }

    _vizClickedRegionID(tappedRegionID, tappedElement) {
        if (this._inSelectionCallback || this._inRegionSet) {
            return;
        }

        this._inSelectionCallback = true;

        // Handle any aliases present in other visualizations
        let targetRegion = this.regionForRegionID(tappedRegionID);
        tappedRegionID = targetRegion.ID;

        let nextRegionID = tappedRegionID;
        let currentRegionClicked = (this.selectedRegionID === tappedRegionID);
        let nowhereLeftToGo = currentRegionClicked && (this.selectedRegionID === this.baseRegion.ID);
        if (nowhereLeftToGo) {
            this.enqueueTopRegions();
        }

        // Go up the region hierarchy if we repeat a click on the currently selected one
        if (currentRegionClicked) {
            // If element doesn't have any functionality related to repeated
            // selection, traverse up the region hierarchy
            if (!this._elementSupportsRepeatedSelection(tappedElement, tappedRegionID)) {
                if (this._nextRegionQueue.length > 0) {
                    nextRegionID = this.popNextRegion().ID;
                } else {
                    nextRegionID = (targetRegion.parentRegion ? targetRegion.parentRegion : this.baseRegion).ID;
                }
            }
        } else { // If we've manually selected a region, blow away the queue
            this.resetRegionQueue();
        }

        this.setRegion(nextRegionID, this._shouldZoomToRegion(nextRegionID), tappedElement, tappedRegionID);

        if (this.selectedRegionID === this.baseRegion.ID) {
            this.map.resetZoom();
        }

        this._inSelectionCallback = false;
    }

    setHoveredRegion(regionID) {
        if (this.hoveredRegionID === regionID) {
            return;
        }

        this.hoveredRegionID = regionID;

        let mapRegions = this._mapRegionIDsForRegionID(regionID);
        this.map.hoverRegionWithID(mapRegions[0]);
        this.rankedBarCharts.forEach(function(chart){
            chart.hoverRegionWithID(regionID);
        });
    }

    setEvaluator(evaluator) {
        if (this._inEvaluatorCallback) {
            return;
        }
        this._inEvaluatorCallback = true;

        this.map.setEvaluator(evaluator);

        this.updateTitles();

        this._inEvaluatorCallback = false;
    }

    _mapRegionIDsForRegionID(regionID) {
        if (this._regionIsCoalition(regionID)) {
            let coalitionRegion = this.regionForRegionID(regionID);
            return coalitionRegion.subregionIDs;
        } else {
            let aliasIDs = this._regionAliasesForRegion(regionID);
            if (aliasIDs !== undefined && aliasIDs.length > 0) {
                return aliasIDs;
            }
        }

        return [regionID];
    }

    zoomToRegion(regionID) {
        let mapRegionIDs = this._mapRegionIDsForRegionID(regionID);
        if (regionID) {
            let regionBounds = this.map.boundingBoxForRegions(mapRegionIDs);
            this.map.zoomToBox(regionBounds);
        }
    }

    setRegion(regionID, zoomToRegion = true, tappedElement = null, tappedRegionID = null) {
        let isRepeatedSelection = (this.selectedRegionID === regionID);
        if (isRepeatedSelection && !this._elementSupportsRepeatedSelection(tappedElement, tappedRegionID)) {
            return;
        }

        if (this._inRegionSet) {
            return;
        }

        this._inRegionSet = true;

        console.log("Setting region ID: " + regionID);

        this.previouslySelectedRegionID = this.selectedRegionID;
        this.selectedRegionID = regionID;

        if (this._regionIsCounty(regionID) && this.didSelectCounty !== null) {
            this.didSelectCounty(this.countyInfectionData);
        }

        if (zoomToRegion) {
            this.zoomToRegion(regionID);
        }

        // Maintain visual position of the tapped element.
        let priorCenterElementYCoord = -1;
        let centeredElement = this.currentlyFocusedChartElement();
        if (centeredElement !== null) {
            priorCenterElementYCoord = centeredElement.getBoundingClientRect().y;
        }

        let shouldAnimate = true;

        this.header.setBackButtonVisible((this.selectedRegionID !== this.baseRegion.ID), shouldAnimate);
        this.updateHeader(shouldAnimate);

        this.map.highlightRegionsWithIDs(this._mapRegionIDsForRegionID(regionID));
        this.updateDashboard(shouldAnimate);
        this.updateDataTable(shouldAnimate, tappedElement, tappedRegionID)
        this.updateTitles(shouldAnimate);
        this.updateOverTimeChartsForDay(this.currentDay, shouldAnimate);
        this.updateRankedChartForDay(this.currentDay, shouldAnimate);
        this.updateSlider();
        this.updateRegionPicker();

        if (centeredElement !== null) {
            let newYCoord = centeredElement.getBoundingClientRect().y;
            if (newYCoord != priorCenterElementYCoord) {
                window.scrollBy(0, newYCoord - priorCenterElementYCoord);
            }
        }

        this._inRegionSet = false;
    }

    regionForRegionID(regionID) {
        if (regionID === undefined) {
            return null;
        }

        let dataset = this._datasetForRegionID(regionID);
        if (dataset === null) {
            return null;
        }
        return dataset.regionForID(regionID);
    }

    unsetRegion(shouldResetZoom) {
        this.setRegion(this.baseRegion.ID, false);
        if (shouldResetZoom) {
            this.map.resetZoom();
        }
    }

    _regionIsState(regionID) {
        return (this._datasetForRegionID(regionID) === this.stateInfectionData);
    }

    _regionIsCounty(regionID) {
        return (this._datasetForRegionID(regionID) === this.countyInfectionData);
    }

    _regionIsCoalition(regionID) {
        return (this._datasetForRegionID(regionID) === this.coalitionInfectionData);
    }

    _regionIsNation(regionID) {
        return (this._datasetForRegionID(regionID) === this.nationInfectionData);
    }

    _regionAliasesForRegion(regionID) {
        let dataset = this._datasetForRegionID(regionID);
        if (dataset === null) {
            return undefined;
        }
        return dataset.regionAtlas.aliasesForRegion(regionID);
    }

    _shouldZoomToRegion(regionID) {
        return this._regionIsState(regionID) || this._regionIsCoalition(regionID);
    }

    updateSlider() {
        if (this.slider !== null) {
            let regionID = !this.selectedRegionID ? NATION_DEFAULT_ID : this.selectedRegionID;
            let sliderData = this._datasetForRegionID(regionID);
            this._updateSliderForTimeSeries(sliderData, regionID);
        }
    }

    _datasetForRegionID(regionID) {
        if (regionID === undefined) {
            return null;
        }
        if (regionID === null) {
            return this.nationInfectionData;
        }

        if (this.stateInfectionData !== null && this.stateInfectionData.containsRegion(regionID)) {
            return this.stateInfectionData;
        } else if (this.nationInfectionData !== null && this.nationInfectionData.containsRegion(regionID)) {
            return this.nationInfectionData;
        } else if (this.countyInfectionData !== null && this.countyInfectionData.containsRegion(regionID)) {
            return this.countyInfectionData;
        } else if (this.coalitionInfectionData !== null && this.coalitionInfectionData.containsRegion(regionID)) {
            return this.coalitionInfectionData;
        }

        return null;
    }

    _datasetForRegionType(regionType) {
        switch (regionType) {
            case RegionType.Nation:
                return this.nationInfectionData;
            case RegionType.Coalition:
                return this.coalitionInfectionData
            case RegionType.State:
                return this.stateInfectionData;
            case RegionType.County:
                return this.countyInfectionData;
        }

        return null;
    }

    _currentDataset() {
        return this._datasetForRegionID(this.selectedRegionID);
    }

    _currentDaysData() {
        return this._currentDataset().dataForDay(this.currentDay);
    }

    _currentRegion() {
        return this.regionForRegionID(this.selectedRegionID);
    }

    _updateSliderForTimeSeries(timeSeries, regionID) {
        let stops = [];
        let numStops = 10;
        let currentPercent = 0;
        while (currentPercent <= 1.000001) {
            let day = timeSeries.dayForPercentElapsed(currentPercent);
            let snapshot = timeSeries.snapshotForDay(day, regionID);
            if (snapshot !== 'undefined') {
                stops.push(new SliderGradientStop(currentPercent, snapshot));
            } else {
                debugger;
            }
            currentPercent += 1.0 / numStops;
        }
        this.slider.updateSliderForStops(stops);
    }

    updateDashboard(animated) {
        let newSnapshot = this._currentInfectionSnapshot();
        let newStats = this._coreStatsForSnapshot(newSnapshot);
        this.statDashboard.updateForStats(newStats);
    }

    updateDataTable(animated, tappedElement = null, tappedRegionID = null) {
        let selectedRegion = this._currentRegion();
        let aggregateRegion = selectedRegion;
        let tableEvaluator = this.dataTable.sortEvaluator;
        let currentLevelIsSupported = tableEvaluator.supportsRegionType(selectedRegion.type);
        if (!currentLevelIsSupported) {
            selectedRegion = selectedRegion.parentRegion;
            aggregateRegion = selectedRegion.topParent();
        }

        this.dataTable.dataIsIncomplete = this.header.dateSelector.isLatest() && this.header.dateSelector.mostRecentDataIsFromToday();

        if (this._elementRequiresUpdateForRegion(tappedElement, tappedRegionID)) {
            let childrenAreSupported = tableEvaluator.supportsRegionType(selectedRegion.type + 1);
            if (!childrenAreSupported && currentLevelIsSupported) {
                // We only want to display coalition regions if someone has explicitly selected one or is traversing up the region hierarchy.
                // Make it so that data table skips this level by default when data isn't available at lower levels.
                aggregateRegion = (selectedRegion.type === RegionType.State) ? selectedRegion.topParent() : selectedRegion.parentRegion;
            }
            let aggregateDataset = this._datasetForRegionID(aggregateRegion.ID);
            let childData = this._childDataSetForRegionOnDay(aggregateRegion.ID, this.currentDay);
            let aggregateSnapshot = aggregateDataset.snapshotForDay(this.currentDay, aggregateRegion.ID);
            this.dataTable.updateForData(aggregateSnapshot, childData, animated, true);
        }

        this.dataTable.updateForHighlightedRegion(selectedRegion.ID);
    }

    updateTitles(animated) {
        let currentRegion = this.regionForRegionID(this.selectedRegionID);
        let thisController = this;
        document.title = "Coronavirus " + currentRegion.preposition + " " + currentRegion.qualifiedNameWithArticle();
        this.overTimeCharts.forEach(function (chart) {
            if (chart.title !== null) {
                let isVisible = thisController.chartIsVisible(chart);
                chart.title.updateForContextChange(chart.evaluator, currentRegion, "day", animated && isVisible);
            }
        });

        // Only update ranked charts if we're above the county level (otherwise there's nothing to rank)
        if (!this._regionIsCounty(currentRegion.ID)) {
            let rankedGroupBy = this._regionIsState(currentRegion.ID) ? "county" : "state";
            this.rankedBarCharts.forEach(function (chart) {
                if (chart.title !== null) {
                    let isVisible = thisController.chartIsVisible(chart);
                    chart.title.updateForContextChange(chart.evaluator, currentRegion, rankedGroupBy, animated && isVisible);
                }
            });
        }
    }

    updateHeader(animated) {
        this.updateHeaderDay(animated);
        this.header.updateForOptions(this._regionMenuGroups());
        this.header.setSelectedRegionWithID(this.selectedRegionID);
    }

    updateHeaderDay(animated) {
        this.header.updateForRegion(this._currentRegion(), this.currentDay);
    }

    updateMapForDay(day, animated) {
        if (this.countyInfectionData !== null) {
            this.map.updateMapForDay(day, this.countyInfectionData, animated);
        }
    }

    _currentChildDataSetForDay(day) {
        return this._childDataSetForRegionOnDay(this._currentRegion().ID, day);
    }

    _childDataSetForRegionOnDay(regionID, day) {
        let dataset = this._datasetForRegionID(regionID);
        let isState = (dataset === this.stateInfectionData);
        let isCoalition = (dataset === this.coalitionInfectionData);
        let isCounty = (dataset === this.countyInfectionData);
        let result = null;
        // If we have a state or coalition selected, filter regions to the relevant parent region
        if ((isState || isCoalition) && regionID) {
            let childDataSet = isState ? this.countyInfectionData : this.stateInfectionData;
            if (childDataSet !== null) {
                result = childDataSet.dataForDay(day, function (infectionSnapshot) {
                    const parentRegion = infectionSnapshot.region.parentRegion;
                    if (parentRegion !== null) {
                        return parentRegion.ID === regionID;
                    } else {
                        console.log("missing parent region for: " + infectionSnapshot.region.name + ", ID: " + infectionSnapshot.region.ID);
                    }
                    return false;
                });
            }
        } else if (!isCounty && this.stateInfectionData !== null) {
            result = this.stateInfectionData.dataForDay(day);
        }

        return result;
    }

    updateRankedChartForDay(day, animated) {
        if (this.stateInfectionData === null) {
            return;
        }

        let dataset = this._currentDataset();
        let currentRegion = this._currentRegion();
        let aggregateRegion = currentRegion;
        let highlightedRegion = null;
        let highlightRegionData = null;

        // If a county is currently selected, feature it via highlight.
        if (currentRegion.type === RegionType.County) {
            aggregateRegion = currentRegion.parentRegion;
            highlightedRegion = currentRegion;
        }

        let rankedSummaryData = this._childDataSetForRegionOnDay(aggregateRegion.ID, day);
        if (rankedSummaryData === null) {
            rankedSummaryData = this.stateInfectionData.dataForDay(day);
        }

        if (highlightedRegion !== null) {
            highlightRegionData = rankedSummaryData.get(highlightedRegion.ID);
        }

        if (rankedSummaryData !== null) {
            let thisController = this;
            this.rankedBarCharts.forEach(function (chart) {
                let isVisible = thisController.chartIsVisible(chart);
                chart.updateForData(rankedSummaryData, highlightRegionData, animated && isVisible);
            });
        }
    }

    updateOverTimeChart(chart, day, region, dataSlice, animated) {
        let evaluator = chart.evaluator;
        if (!evaluator.supportsRegionType(region.type)) {
            chart.hide(animated);
            return;
        } else {
            chart.show(animated);
        }
        if (evaluator.benchmarkEvaluator !== null) {
            if (region.ID === NATION_DEFAULT_ID) {
                chart.benchmarkSeries = null;
            } else if (chart.benchmarkSeries === null) {
                // This should reuse some of the above dataset logic and crawl up the region parent chain
                // to support more flexible benchmarking. For now just force it to be nation
                let dataset = this._datasetForRegionType(evaluator.benchmarkRegionType);
                let benchmarkSlice = dataset.timeSeriesEndingAt(day).dataSliceForRegionID(NATION_DEFAULT_ID);
                chart.benchmarkSeries = new OverTimeSeries(benchmarkSlice, evaluator.benchmarkEvaluator);
            }
        }
        let isVisible = this.chartIsVisible(chart);
        chart.updateForData(dataSlice, animated && isVisible);
        chart.updateDescriptionForRegion(region);
    }

    currentOverTimeDataSlice(day) {
        let dataUpToThisPoint = this._currentDataset().timeSeriesEndingAt(day);
        let regionID = this.selectedRegionID ? this.selectedRegionID: NATION_DEFAULT_ID;
        let dataSlice = dataUpToThisPoint.dataSliceForRegionID(regionID);
        return dataSlice;
    }

    updateOverTimeChartsForDay(day, animated) {
        let dataSlice = this.currentOverTimeDataSlice(day);
        if (dataSlice) {
            let thisController = this;
            let currentRegion = this._currentRegion();
            this.overTimeCharts.forEach(function (chart) {
                thisController.updateOverTimeChart(chart, day, currentRegion, dataSlice, animated);
            });
        }
    }

    updateRegionPicker() {
        if (this._regionPickerActive && this.regionPicker !== null) {
            this.regionPicker.selectRegionWithID(this.selectedRegionID);
        }
    }

    setDay(day, animated = false) {
        if (this.currentDay === day) {
            return;
        }
        let isFirstUpdate = (this.currentDay === undefined);
        this.currentDay = day;

        // We don't need to update map/titles for day updates.
        if (isFirstUpdate) {
            this.updateMapForDay(day, animated);
            this.updateTitles(animated);
        }

        this.updateHeaderDay(animated);

        this.updateDashboard(animated);
        this.updateDataTable(animated);
        this.updateRankedChartForDay(day, animated);
        this.updateOverTimeChartsForDay(day, animated);

        // Don't update the slider if this update is already a result of it being dragged (will cause rounding jitter)
        if (this.slider !== null && !this.slider.isBeingDragged) {
            this.slider.updateSliderForPercentComplete(this.nationInfectionData.percentElapsedForDay(day));
        }
    }

    play() {
        if (this.timer) {
            this.timer.stop();
        }

        let days = this.nationInfectionData.days();
        let currentDayIndex = 0;
        let thisController = this;
        this.timer = timer(function(elapsed) {
            if(Math.floor(elapsed/MS_PER_DAY) > currentDayIndex) {
                currentDayIndex++;
                const currentDay = days.next();
                if (currentDay.done) {
                    thisController.timer.stop();
                } else {
                    thisController.setDay(currentDay.value, true);
                }
            }

        }, 150);
    }

    pause() {
        if (this.timer) {
            this.timer.stop();
        }
    }

    _pageAttribution(parentElementSelection) {
        let result = parentElementSelection.append("div")
            .attr("class", "attribution-footer content-column")
            .html("<p>Data is updated and aggregated every hour according to several open-source datasets.</p><p>Case and death data is reported via the <a href=\"https://www.nytimes.com/interactive/2020/us/coronavirus-us-cases.html\">New York Times</a>. Testing and hospitalization data is reported via the <a href=\"https://covidtracking.com/\">COVID Tracking Project</a>. Visitation data is reported via <a href=\"https://www.google.com/covid19/mobility/\">Google Community Mobility Reports</a>.</p><p>Site is developed and maintained by <a href=\"https://www.twitter.com/codeblue87\">Ben Cunningham</a>. Front-end code is available on <a href=\"https://github.com/bcunning/CoronaViz\">github</a>.</p>");
        return result;
    }
}