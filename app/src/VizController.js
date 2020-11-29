import { format } from 'd3-format';

import CGRect from "./CGRect.js";
import DataTable from "./DataTable.js";
import EvaluatorLibrary from "./EvaluatorLibrary.js";
import Infection from "./Infection.js";
import MapVisualization from "./MapVisualization.js";
import MobilityEvaluator from "./MobilityEvaluator.js";
import OverTimeVisualization from "./OverTimeVisualization.js";
import RankedBarVisualization from "./RankedBarVisualization.js";
import Stat from "./Stat.js";
import StatDashboard from "./StatDashboard.js";
import VizHeader from "./VizHeader.js";

import { NATION_DEFAULT_ID } from "./Constants.js";
import OverTimeSeries from "./OverTimeSeries";
import {RegionType} from "./Region";
import TableConfigurationView from "./TableConfigurationView";
import Atlas from "./Atlas";

const MAP_VIZ_WIDTH = 900;
const MAP_VIZ_HEIGHT = 450;

const RANKED_BAR_VIZ_WIDTH = 600;
const RANKED_BAR_VIZ_HEIGHT = 400;

const HEADER_COLLAPSE_SCROLL_DISTANCE = 20.0;

const BROWSER_BACK_BUTTON_ELEMENT = "BrowserBackButton";
const GOOGLE_ANALYTICS_ID = "UA-164933561-1";

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
        this.previouslySelectedRegionID = null;
        this._inRegionSet = false;
        this._inDataChange = false;
        this._processingURL = false;
        this._processingHash = true;
        this.didSelectCounty = null;

        const thisController = this;

        this.setNationData(nationInfectionData);
        this.setCoalitionData(coalitionInfectionData);
        this.setStateData(stateInfectionData);
        this.setCountyData(countyInfectionData);

        let dateRange = [this.nationInfectionData.firstDay, this.nationInfectionData.lastDay];

        // This spacer always needs to be the first thing added to parentElementSelection
        this.headerSpacer = parentElementSelection.append("div").attr("class", "header-spacer");
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

        // Header Components
        this.headerContainer = parentElementSelection.append("div").attr("class", "fixed-header-summary");
        this.header = new VizHeader(this.headerContainer, this._regionMenuGroups(), dateRange);

        this.map = new MapVisualization(MAP_VIZ_WIDTH,
                                        MAP_VIZ_HEIGHT,
                                        this.headerContainer,
                                        countryGeometry,
                                        EvaluatorLibrary.confirmedCaseEvaluator());

        this.header.setFeaturedCollapseElement(this.map);

        this._updateFixedRegionSpacing();

        // View-state
        this.selectedRegionID = nationRegion.ID;
        this.hoveredRegionID = null;
        this.lastWindowWidthUpdate = window.outerWidth;

        // Callbacks
        window.addEventListener('resize', function() {
            thisController.didResize();
        });
        window.addEventListener('scroll', function() {
            thisController.didScroll(this, !thisController._processingHash);
        })

        window.onpopstate = function(e){
            let region = thisController.deepestAvailableRegionFromCurrentURLPath();
            let regionID = region.ID;

            if (regionID !== thisController.selectedRegionID) {
                thisController.setRegion(regionID, true, BROWSER_BACK_BUTTON_ELEMENT);
            }
        };

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
            if (thisController.selectedRegionID !== thisController.baseRegion.ID) {
                thisController.unsetRegion(true);
            } else {
                document.body.scrollIntoView({behavior: 'smooth', block: 'start'});
            }
        };

        this.map.didScrollAwayFromHighlightedState = function() {
            console.log("Did scroll away from highlighted state");
            thisController.unsetRegion(false);
        };

        this.collapsed = false;
        this.lastScrollOffset = 0;
        this.didScroll(window, false);

        let moreToLoad = this.processURLPath(false);
        this.setDay(this.nationInfectionData.lastDayString());
        if (this.selectedRegionID !== this.baseRegion.ID) {
            this.zoomToRegion(this.selectedRegionID, false);
            this.map.highlightRegionsWithIDs(this._mapRegionIDsForRegionID(this.selectedRegionID), false);
        }

        this.processURLHash();

        if (moreToLoad) {
            this.header.setIsLoading(true);
        }
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

                this.updateRankedChartForDay(this.currentDay, false);
                this.updateDashboard(false);
                this.updateDataTable(false);
            }
        } else {
            this.stateInfectionData = null;
        }
    }

    setCountyData(timeSeries) {
        let wasEmpty = (this.countyInfectionData == null);
        if (timeSeries) {
            this.countyInfectionData = timeSeries.timeSeriesBeginningAt(this.firstDay);

            let weakThis = this;
            let regionID = this.selectedRegionID;
            this._preserveContentOffsetAroundBlock(function () {
                weakThis.header.setIsLoading(false);

                if (wasEmpty && weakThis._regionIsState(weakThis.dataTable.aggregateRegionID)) {
                    weakThis.updateDataTable(false);
                }
                let countyDataIsDisplayedInRankedBars = (weakThis._regionIsState(regionID) || weakThis._regionIsCounty(regionID));
                if (wasEmpty && countyDataIsDisplayedInRankedBars) {
                    weakThis.updateRankedChartForDay(weakThis.currentDay, false);
                }
                if (weakThis.map !== undefined) {
                    weakThis.updateMapForDay(weakThis.currentDay, true);
                }
            });

        } else {
            this.countyInfectionData = null;
        }
    }

    processURLHash(animated= false) {
        let hashComponents = window.location.hash.split('#').filter(function (string) {
            return string.length > 0;
        });

        this._processingHash = true;
        if (hashComponents.length > 0) {
            console.log("Processing hash: " + hashComponents[0]);
            window.location = location.href;
        }

        let thisController = this;
        setTimeout(function () {
            thisController._processingHash = false;
        }, 100);
    }

    processURLPath(requireUpdate = true, animated = false, registerView = false) {

        let regionHierarchyPath = VizController.CurrentURLComponents();
        let region = this.deepestAvailableRegionFromBreadCrumb(regionHierarchyPath);
        let moreToLoad = regionHierarchyPath.length > 1 && !this._regionIsCounty(region.ID);
        let invalidCounty = (this.countyInfectionData !== null && regionHierarchyPath.length > 1 && !this._regionIsCounty(region.ID));
        let invalidStateOrCoalition = (regionHierarchyPath.length > 0 && region.ID === this.baseRegion.ID);
        if (invalidCounty || invalidStateOrCoalition) {
            console.log("404: No region for: " + regionHierarchyPath.last());
            this.updateBrowserStateForRegion(this.regionForRegionID(this.selectedRegionID));
            return false;
        }

        this._processingURL = true;

        if (requireUpdate && region.ID !== this.baseRegion.ID) {
            this.setRegion(region.ID, false, this, null, animated);
            this.zoomToRegion(region.ID, this._regionIsCounty(region.ID));
        } else {
            this.selectedRegionID = region.ID;
        }

        if (region.ID !== this.baseRegion.ID) {
            this.resetRegionQueue();
        }

        if (registerView) {
            this.registerPageView();
        }

        this._processingURL = false;

        return moreToLoad;
    }

    static CurrentURLComponents() {
        return window.location.pathname.split('/').filter(function (string) {
            return string.length > 0;
        });
    }

    deepestAvailableRegionFromCurrentURLPath() {
        let regionHierarchyPath = VizController.CurrentURLComponents();
        return this.deepestAvailableRegionFromBreadCrumb(regionHierarchyPath);
    }

    _decodeURLRegionName(regionName) {
        return regionName.replace(/-/g, " ");
    }

    _encodeURLRegionName(regionName) {
        return regionName.replace(/ /g, "-");
    }

    deepestAvailableRegionFromBreadCrumb(regionNames) {
        if (regionNames.length === 0) {
            return this.baseRegion;
        }

        let rootName = this._decodeURLRegionName(regionNames[0]);
        let rootDataset = this._datasetForRegionName(rootName);
        if (rootDataset === null) {
            return this.baseRegion;
        }
        let rootRegion = rootDataset.regionWithName(rootName);

        // If we've only specified one path, or we don't have any county data to go further anyway, we're done.
        if (regionNames.length === 1 || this.countyInfectionData === null) {
            return rootRegion;
        }

        // Otherwise see if there's a county with the relevant name
        let countyName = Atlas.normalizeRegionName(this._decodeURLRegionName(regionNames[1]));
        let counties = this.countyInfectionData.topRegions(0, function (snapshot) {
                if (snapshot.region.parentRegion !== null) {
                    if (snapshot.region.parentRegion.ID === rootRegion.ID) {
                        let normalizedName = Atlas.normalizeRegionName(snapshot.region.name);
                        return normalizedName === countyName;
                    }
                }
                return false;
            },
            EvaluatorLibrary.regionNameEvaluator()
        );

        if (counties === null || counties.length === 0) {
            return rootRegion;
        }

        return counties[0];
    }

    updateCountryGeometry(countryGeomery) {
        this.map.updateForCountryGeometry(countryGeomery)
    }

    updateMobilityChart() {
        // For now just grab the last one.
        let mobilityChart = this.overTimeCharts.last();
        let dataSlice = this.currentOverTimeDataSlice(this.currentDay);
        let weakThis = this;
        this._preserveContentOffsetAroundBlock(function() {
            weakThis.updateOverTimeChart(mobilityChart, weakThis.currentDay, weakThis._currentRegion(), dataSlice, true);
        })
    }

    isStateSelected() {
        return this._regionIsState(this.selectedRegionID);
    }

    isCoalitionSelected() {
        return this._regionIsCoalition(this.selectedRegionID);
    }

    didResize() {
        let currentWidth = window.innerWidth;
        if (currentWidth !== this.lastWindowWidthUpdate) {
            this.header.resetHeaderHeight();
            this._updateFixedRegionSpacing();

            this.map.didResize();
            this.overTimeCharts.forEach(function (chart) {
                chart.didResize();
            });
            this.rankedBarCharts.forEach(function (chart) {
                chart.didResize();
            });

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
            this._nextRegionQueue = this.coalitionInfectionData.topRegions(0, null, EvaluatorLibrary.newConfirmedCaseEvaluator());
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
        return [EvaluatorLibrary.EvaluatorWithAnchor(EvaluatorLibrary.newConfirmedCaseEvaluator(), "ranked-cases"),
                EvaluatorLibrary.EvaluatorWithAnchor(EvaluatorLibrary.newDeathEvaluator(), "ranked-deaths")];
    }

    _updateFixedRegionSpacing() {
        // Fix scroll sizing so that floating header doesn't obscure any content
        let headerOffsetHeight = this.headerContainer.node().offsetHeight;
        this.headerSpacer.style("height", headerOffsetHeight + "px");
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

    zoomToRegion(regionID, animated = true) {
        let mapRegionIDs = this._mapRegionIDsForRegionID(regionID);
        if (regionID) {
            let padding = 1.0;
            if (this._regionIsCounty(regionID)) {
                padding = 3.0;
            } else if (this._regionIsCoalition(regionID)) {
                padding = 0.8;
            }
            let regionBounds = this.map.boundingBoxForRegions(mapRegionIDs, padding);
            this.map.zoomToBox(regionBounds, animated);
        }
    }

    setRegion(regionID, zoomToRegion = true, tappedElement = null, tappedRegionID = null, animated = true) {
        let isRepeatedSelection = (this.selectedRegionID === regionID);
        if (isRepeatedSelection && !this._elementSupportsRepeatedSelection(tappedElement, tappedRegionID)) {
            return;
        }

        if (this._inRegionSet || this._inDataChange) {
            return;
        }

        this._inRegionSet = true;

        console.log("Setting region ID: " + regionID);

        this.previouslySelectedRegionID = this.selectedRegionID;
        this.selectedRegionID = regionID;

        if (this._regionIsCounty(regionID) && this.didSelectCounty !== null) {
            this.didSelectCounty(this.countyInfectionData);
        }

        let thisController = this;
        this._preserveContentOffsetAroundBlock(function () {
            // Don't push new state if this is the result of navigating browser state
            // (e.g. the user hitting the back button)
            if (tappedElement !== BROWSER_BACK_BUTTON_ELEMENT && !thisController._processingURL) {
                thisController.updateBrowserStateForRegion(thisController._currentRegion());
            }

            thisController._updateForDataChange(zoomToRegion, false, tappedElement, tappedRegionID, animated);
        });

        this._inRegionSet = false;
    }

    _preserveContentOffsetAroundBlock(blockToExecute) {
        // Maintain visual position of the currently focused element.
        let priorCenterElementYCoord = -1;
        let isAtTop = this.lastScrollOffset < HEADER_COLLAPSE_SCROLL_DISTANCE;
        let centeredElement = isAtTop ? null : this.currentlyFocusedChartElement();
        if (centeredElement !== null) {
            priorCenterElementYCoord = centeredElement.getBoundingClientRect().y;
        }

        blockToExecute();

        if (centeredElement !== null) {
            let newYCoord = centeredElement.getBoundingClientRect().y;
            if (newYCoord != priorCenterElementYCoord) {
                window.scrollBy(0, newYCoord - priorCenterElementYCoord);
            }
        }
    }

    _updateForDataChange(zoomToRegion = true, redrawMap = true, tappedElement = null, tappedRegionID = null, animated = false) {

        if (this._inDataChange) {
            return;
        }

        this._inDataChange = true;

        this.header.setBackButtonVisible((this.selectedRegionID !== this.baseRegion.ID), animated);
        this.updateHeader(animated);

        if (redrawMap) {
            this.updateMapForDay(this.currentDay, animated);
        }

        this.map.highlightRegionsWithIDs(this._mapRegionIDsForRegionID(this.selectedRegionID), animated);
        if (zoomToRegion) {
            this.zoomToRegion(this.selectedRegionID, animated);
        }

        this.updateDashboard(animated);
        this.updateDataTable(animated, tappedElement, tappedRegionID)
        this.updateTitles(animated);
        this.updateOverTimeChartsForDay(this.currentDay, animated);
        this.updateRankedChartForDay(this.currentDay, animated);

        this._inDataChange = false;
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
        return this._regionIsState(regionID) || this._regionIsCoalition(regionID) || this._regionIsCounty(regionID);
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

    _datasetForRegionName(regionName) {
        if (regionName === undefined) {
            return null;
        }
        if (regionName === null) {
            return this.nationInfectionData;
        }

        if (this.nationInfectionData !== null && this.nationInfectionData.containsRegionName(regionName)) {
            return this.nationInfectionData;
        } else if (this.coalitionInfectionData !== null && this.coalitionInfectionData.containsRegionName(regionName)) {
            return this.coalitionInfectionData;
        } if (this.stateInfectionData !== null && this.stateInfectionData.containsRegionName(regionName)) {
            return this.stateInfectionData;
        } else if (this.countyInfectionData !== null && this.countyInfectionData.containsRegionName(regionName)) {
            return this.countyInfectionData;
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
            let childType = selectedRegion.type + 1;
            let childrenAreSupported = tableEvaluator.supportsRegionType(childType);
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

    updateBrowserStateForRegion(region) {
        console.log("Updating browser history for: " + region.name);
        let isBaseRegion = (region.ID === this.baseRegion.ID);
        let URL = isBaseRegion ? "/" : this.URLPathForRegion(region);
        history.pushState({"regionID" : region.ID}, document.title, URL);
        this.registerPageView();
    }

    registerPageView() {
        if (typeof gtag === "function") {
            let URL = window.location.pathname;
            let title = document.title;
            gtag('config', GOOGLE_ANALYTICS_ID, {
                'page_title' : title,
                'page_path': URL
            });
        }
    }

    URLPathForRegion(region) {
        let components = [region];
        if (this._regionIsCounty(region.ID)) {
            components.unshift(region.parentRegion);
        }
        let thisController = this;
        components = components.map(function (region) {
            return "/" + thisController._encodeURLRegionName(Atlas.normalizeRegionName(region.name));
        })

        let result = components.join("");
        return result;
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
            let numCharts = this.overTimeCharts.length;
            for (let i = 0; i < numCharts; i++) {
                // Go in reverse order so that a suddenly invalidated (and hidden) chart
                // doesn't cause the currently viewed chart to become "not visible" via document reflow.
                // The result of that situation is a chart not animating when it should.
                let chart = thisController.overTimeCharts[numCharts - 1 - i];
                thisController.updateOverTimeChart(chart, day, currentRegion, dataSlice, animated);
            }
        }
    }

    setDay(day, animated = false) {
        if (this.currentDay === day) {
            return;
        }
        this.previousDay = this.currentDay;
        this.currentDay = day;
        let isFirstUpdate = (this.previousDay === undefined);

        this._updateForDataChange(false, isFirstUpdate,null, null, animated);
    }

    _pageAttribution(parentElementSelection) {
        let result = parentElementSelection.append("div")
            .attr("class", "attribution-footer content-column")
            .html("<p>Data is updated and aggregated every hour according to the following open-source datasets:</p><p>Case and death data is reported via <a href=\"https://www.nytimes.com/interactive/2020/us/coronavirus-us-cases.html\">The New York Times</a>. Testing and hospitalization data is reported via the <a href=\"https://covidtracking.com/\">COVID Tracking Project</a>. Visitation data is calculated via <a href=\"https://www.google.com/covid19/mobility/\">Google Community Mobility Reports</a>.</p><p>Site is developed and maintained by <a href=\"https://www.twitter.com/codeblue87\">Ben Cunningham</a>. Front-end code is available on <a href=\"https://github.com/bcunning/CoronaViz\">github</a>.</p>");
        return result;
    }
}