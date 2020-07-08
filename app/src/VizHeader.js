import { interpolateString } from 'd3-interpolate';

import ResizingSelect from "./ResizingSelect.js";
import {normalizeDate} from "./DateUtils";
import { PANDEMIC_NAME } from "./Constants.js";
import DateSelector from "./DateSelector";
import NavControl from "./NavControl";

const NO_ANIMATION_CLASS = "no-transition";
const FRAME_DURATION = 30.0;

export default class VizHeader {
    constructor(parentElementSelection, allRegions, dateRange) {
        this.isLoading = false;
        this.allRegions = allRegions;
        this.parentElement = parentElementSelection;
        this.container = parentElementSelection.append("div").attr("class", "header-container");
        this.collapsedFeatureElement = null;

        let textAlign = "left";

        // Top line title with region select
        this.titleContainer = this.container.append("div")
            .attr("class", "title title-container header-title-element content-column header-expanded-element")
            .style("text-align", textAlign);
        this.titleNav = new NavControl(this.titleContainer);
        this.titleTextContainer = this.titleNav.container.append("div").attr("class", "title-text-container");
        this.virusName = this.titleTextContainer.append("span").attr("class", "robo-text").text(PANDEMIC_NAME + " ");
        this.regionPreposition = this.titleTextContainer.append("span").attr("class", "robo-text");
        this.regionSelect = new ResizingSelect(this.titleTextContainer);

        // Subtitle description of data
        this.dataByline = this.titleContainer.append("h3")
            .attr("class", "subtitle header-subtitle-element header-expanded-element")
            .style("text-align", textAlign)
            .html("Data from the New&nbsp;York&nbsp;Times and the COVID&nbsp;Tracking&nbsp;Project");
        this.dateSelector = new DateSelector(this.titleContainer, textAlign);

        this.expandedElements = [this.titleContainer, this.dataByline, this.dateSelector.container];

        // The compact title container is what appears when we collapse the header
        this.compactTitleContainer = this.container.append("div")
            .attr("class", "title title-container standalone header-collapsed-element")
            .style("transform", "translateY(-100%)");
        this.compactTitleContent = this.compactTitleContainer.append("div").attr("class", "standalone-title-content");
        this.compactTitleNav = new NavControl(this.compactTitleContent, true);
        this.compactRegionSelect = new ResizingSelect(this.compactTitleContent, true);
        this.compactDateSelector = new DateSelector(this.compactTitleContent, "right", true);

        this.updateForOptions(allRegions);

        let thisHeader = this;
        this.titleNav.didClickBackButton = function () { thisHeader._didClickBackButton(); };
        this.compactTitleNav.didClickBackButton = this.titleNav.didClickBackButton;

        this._computeCollapsedLayout();
        this.setCollapsed(false, false);
        this.didClickBackButton = null;
    }

    _didClickBackButton() {
        if (this.didClickBackButton !== null) {
            this.didClickBackButton();
        }
    }

    _computeCollapsedLayout() {
        let compactTitleNode = this.compactTitleContainer.node();
        this.minHeaderHeight = compactTitleNode.offsetTop + compactTitleNode.offsetHeight;
        this.maxHeaderHeight = this._currentHeaderNodeHeight();

        // Lock height
        if (this.collapsedFeatureElement !== null) {
            let parentHeight = this.parentElement.node().offsetHeight;
            let expandedHeight = this.isCollapsed ? parentHeight + (this.maxHeaderHeight - this.minHeaderHeight) : parentHeight;
            this.parentElement.style("height", expandedHeight + "px");
        }
    }

    _currentHeaderNodeHeight() {
        let headerNode = this.container.node();
        let headerPadding = parseInt(this.container.style("padding-bottom").replace("px", ""));
        let result = headerNode.offsetTop + headerNode.offsetHeight - headerPadding;
        return result;
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
        this._updateForResize();
        this._computeCollapsedLayout();
    }

    _updateFeaturedElementPosition(animated = true) {
        if (this.collapsedFeatureElement === null) {
            return;
        }
        let marginOffset = this.isCollapsed ? this.minHeaderHeight - this.maxHeaderHeight - 2 : 0;
        let containerSelection = this.collapsedFeatureElement.container;
        let node = containerSelection.node();
        if (!animated) {
            node.classList.add(NO_ANIMATION_CLASS);
        }
        containerSelection.style("transform", "translateY(" + marginOffset + "px)");
        if (!animated) {
            // Don't remove this class on the same frame or an animation will get triggered anyway
            setTimeout(function () {
                node.classList.remove(NO_ANIMATION_CLASS);
            }, FRAME_DURATION);
        }
    }

    _addLoadingMessage(parentElementSelection, beforeSelector = null, isStandalone = false) {
        let standaloneClass = isStandalone ? " standalone" : "";
        let baseClass = isStandalone ? "loading-title-standalone" : "loading-title";
        let result = parentElementSelection.insert("div", beforeSelector)
            .attr("class", "region-select-text title " + baseClass + standaloneClass)
            .text("Loading Counties");
        let ellipsis = result.append("div").attr("class", "lds-ellipsis");
        ellipsis.html("<div></div><div></div><div></div><div></div>");

        return result;
    }

    setIsLoading(isLoading) {
        if (this.isLoading === isLoading) {
            return;
        }

        if (isLoading) {
            this.titleLoadingText = this._addLoadingMessage(this.titleContainer, "div.nav-control", false);
            this.compactTitleLoadingText = this._addLoadingMessage(this.compactTitleContent, "form.region-select-text", true);

            this.titleNav.container.style("display", "none");
            this.compactRegionSelect.elementSelection().style("display", "none");
        } else {
            this.titleLoadingText.remove();
            this.compactTitleLoadingText.remove();

            this.titleLoadingText = null;
            this.compactTitleLoadingText = null;

            this.titleNav.container.style("display", "flex");
            this.compactRegionSelect.elementSelection().style("display", "flex");
        }

        this.isLoading = isLoading;
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
            selection.style("opacity", percentExpanded);
        });

        // Pull down the compact view
        let transformString = "translateY(-" + (100 * percentExpanded) + "%)";
        let compactTitleNode = this.compactTitleContainer.node();
        if (!animated) {
            compactTitleNode.classList.add(NO_ANIMATION_CLASS);
        }
        this.compactTitleContainer.style("transform", transformString);
        if (!animated) {
            // Don't remove this class on the same frame or an animation will get triggered anyway
            setTimeout(function () {
                compactTitleNode.classList.remove(NO_ANIMATION_CLASS);
            }, FRAME_DURATION);
        }

        // Float up the featured element
        this._updateFeaturedElementPosition(animated);
    }

    updateForRegion(region, day) {
        this.regionPreposition.text(region.prepositionString());

        this.setDate(day);
    }

    setDate(day) {
        let date = new Date(day);
        date = normalizeDate(date);

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

    _updateForResize() {
        let newMaxHeight = this._currentHeaderNodeHeight();
        if (newMaxHeight !== this.maxHeaderHeight) {
            this.maxHeaderHeight = newMaxHeight;
            this._updateFeaturedElementPosition(false);
        }
    }

    setSelectedRegionWithID(regionID) {
        this.regionSelect.setSelectedRegionWithID(regionID);
        this.compactRegionSelect.setSelectedRegionWithID(regionID);

        this._updateForResize();
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