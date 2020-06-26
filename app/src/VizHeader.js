import { interpolateString } from 'd3-interpolate';

import ResizingSelect from "./ResizingSelect.js";
import {normalizeDate} from "./DateUtils";
import { PANDEMIC_NAME } from "./Constants.js";
import DateSelector from "./DateSelector";
import NavControl from "./NavControl";

const HEADER_COLLAPSE_DURATION = 500.0;

export default class VizHeader {
    constructor(parentElementSelection, allRegions, dateRange) {
        this.allRegions = allRegions;
        this.parentElement = parentElementSelection;
        this.container = parentElementSelection.append("div").attr("class", "header-container");
        this.collapsedFeatureElement = null;

        let textAlign = "left";

        // Top line title with region select
        this.titleContainer = this.container.append("div")
            .attr("class", "title title-container header-title-element content-column")
            .style("text-align", textAlign);
        this.titleNav = new NavControl(this.titleContainer);
        this.titleTextContainer = this.titleNav.container.append("div").attr("class", "title-text-container");
        this.virusName = this.titleTextContainer.append("div").attr("class", "robo-text").text(PANDEMIC_NAME + " ");
        this.regionPreposition = this.titleTextContainer.append("div").attr("class", "robo-text");
        this.regionSelect = new ResizingSelect(this.titleTextContainer);

        // Subtitle description of data
        this.dataByline = this.titleContainer.append("h3")
            .attr("class", "subtitle header-subtitle-element")
            .style("text-align", textAlign)
            .html("Data from the New&nbsp;York&nbsp;Times and the COVID&nbsp;Tracking&nbsp;Project");
        this.dateSelector = new DateSelector(this.titleContainer, textAlign);

        this.expandedElements = [this.titleContainer, this.dataByline, this.dateSelector.container];

        // The compact title container is what appears when we collapse the header
        this.compactTitleContainer = this.container.append("div")
            .attr("class", "title title-container standalone")
            .style("transform", "translateY(-100%)");
        this.compactTitleContent = this.compactTitleContainer.append("div").attr("class", "standalone-title-content");
        this.compactTitleNav = new NavControl(this.compactTitleContent, true);
        this.compactRegionSelect = new ResizingSelect(this.compactTitleNav.container, true);
        this.compactDateSelector = new DateSelector(this.compactTitleContent, textAlign, true);

        // this.compactTrendLine = new OverTimeVisualization(this.compactTitleContent, EvaluatorLibrary.newConfirmedCaseEvaluator(), ChartDisplayMode.MiniWithTitle);
        // this.compactTrendLine.fixTimeDomain(dateRange[0], dateRange[1]);

        this.updateForOptions(allRegions);

        let thisHeader = this;
        this.titleNav.didClickBackButton = function () { thisHeader._didClickBackButton(); };
        this.compactTitleNav.didClickBackButton = this.titleNav.didClickBackButton;

        this._computeCollapsedLayout();
        this.setCollapsed(false, false);
    }

    _didClickBackButton() {
        if (this.onRegionSelected !== null) {
            this.onRegionSelected(this.regionSelect.selectedRegionID);
        }
    }

    _computeCollapsedLayout() {
        let compactTitleNode = this.compactTitleContainer.node();
        let headerNode = this.container.node();
        let headerPadding = parseInt(this.container.style("padding-bottom").replace("px", ""));
        this.minHeaderHeight = compactTitleNode.offsetTop + compactTitleNode.offsetHeight;
        this.maxHeaderHeight = headerNode.offsetTop + headerNode.offsetHeight - headerPadding;
        this.collapseScrollDistance = this.maxHeaderHeight - this.minHeaderHeight;

        // Lock height
        if (this.collapsedFeatureElement !== null) {
            let parentHeight = this.parentElement.node().offsetHeight;
            let expandedHeight = this.isCollapsed ? parentHeight + this.collapseScrollDistance : parentHeight;
            this.parentElement.style("height", expandedHeight + "px");
        }
    }

    setBackButtonVisible(visible, animated = true) {
        this.titleNav.setBackButtonVisible(visible, animated);
        this.compactTitleNav.setBackButtonVisible(visible, animated);
    }

    setFeaturedCollapseElement(element) {
        this.collapsedFeatureElement = element;
        this._computeCollapsedLayout();
    }

    resetHeaderHeight() {
        this.parentElement.style("height", "unset");
        this._computeCollapsedLayout();
    }

    setCollapsed(isCollapsed, animated) {

        if (this.isCollapsed === isCollapsed) {
            return;
        }

        this.isCollapsed = isCollapsed;

        let percentCollapsed = isCollapsed ? 1.0 : 0.0;
        let percentExpanded = 1.0 - percentCollapsed;

        // Fade out outgoing elements
        this.expandedElements.forEach(function (selection) {
            let appliedSelection = selection;
            if (animated) {
                appliedSelection = selection.transition().duration(HEADER_COLLAPSE_DURATION);
            }
            appliedSelection.style("opacity", percentExpanded);
        });

        // Adjust our total height
        let marginOffset = isCollapsed ? this.minHeaderHeight - this.maxHeaderHeight - 2 : 0;
        let containerSelection = this.container;
        if (animated) {
            containerSelection = containerSelection.transition().duration(HEADER_COLLAPSE_DURATION);
        }
        containerSelection.style("margin-bottom", marginOffset + "px");

        // Pull down the compact view
        let transformString = "translateY(-" + (100 * percentExpanded) + "%)";
        if (animated) {
            let originTransformString = "translateY(-" + (100 * percentCollapsed) + "%)";
            let translateInterpolator = interpolateString(originTransformString, transformString);

            this.compactTitleContainer.transition()
                .duration(HEADER_COLLAPSE_DURATION)
                .styleTween('transform', function (d) {
                    return translateInterpolator;
                });
        } else {
            this.compactTitleContainer.style("transform", transformString);
        }
    }

    containsElement(element) {
        let currentElement = element;
        let containerElement = this.container.node();
        while (currentElement !== null) {
            if (currentElement === containerElement) {
                return true;
            }

            currentElement = currentElement.parentElement;
        }

        return false;
    }

    updateForRegion(region, day) {
        this.regionPreposition.text(region.prepositionString());

        this.setDate(day);
    }

    setDate(day) {
        let date = new Date(day);
        date = normalizeDate(date);
        // let dateString = date.toLocaleDateString("en-US", { month: 'long', day: 'numeric', year: 'numeric' });
        this.dateSelector.setDate(date);
        if (this.compactDateSelector !== undefined) {
            this.compactDateSelector.setDate(date);
        }
    }

    // RegionSelect forwarding

    set onRegionSelected(callback) {
        this.regionSelect.onRegionSelected = callback;
        this.compactRegionSelect.onRegionSelected = callback;
    }

    get onRegionSelected() {
        return this.regionSelect.onRegionSelected;
    }

    setSelectedRegionWithID(regionID) {
        this.regionSelect.setSelectedRegionWithID(regionID);
        this.compactRegionSelect.setSelectedRegionWithID(regionID);
    }

    updateForOptions(options) {
        this.regionSelect.updateForOptions(options);
        this.compactRegionSelect.updateForOptions(options);
    }

    // DateSelector forwarding

    set onDateChanged(callback) {
        this.dateSelector.onDateChanged = callback;
        this.compactDateSelector.onDateChanged = callback;
    }

    get onDateChanged() {
        return this.dateSelector.onDateChanged;
    }
}