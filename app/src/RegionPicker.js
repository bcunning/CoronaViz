import { REGION_TRANSITION_DURATION } from "./Constants.js";
import {interpolateNumber} from "d3-interpolate";

function scrollLeftTween(scrollLeft) {
    return function () {
        let i = interpolateNumber(this.scrollLeft, scrollLeft);
        return function (t) {
            this.scrollLeft = i(t);
        };
    };
}

export default class RegionPicker {
    constructor(parentElementSelection, regionSections) {
        let thisPicker = this;

        this.container = parentElementSelection.append("div")
            .attr("class", "region-picker")
            .on("scroll", function() {
                thisPicker._didScroll();
            });

        this.sectionTitleContainer = this.container.append("div").attr("class", "region-section-container");
        this.spacer = this.container.append("div").attr("class", "region-spacer");
        this.regionContainer = this.container.append("div").attr("class", "region-container");

        this.fixedSectionIndex = -1;
        this.sectionRanges = null;
        this.activeRegion = null;
        this.onRegionClicked = null;

        this.selectRegionWithID(regionSections[0].regions[0].ID);
        this.updateForRegionSections(regionSections);
    }

    _updateActiveRegionDisplay() {
        let thisPicker = this;
        this.regionContainer.selectAll("div").attr("class", region => thisPicker._buttonClassForRegion(region));
    }

    updateForRegionSections(regionSections) {

        this.regionSections = regionSections;
        let allRegions = [];
        regionSections.forEach(function(section) {
            allRegions = allRegions.concat(section.regions);
        });
        this.regions = allRegions;

        let thisPicker = this;
        this.regionContainer.selectAll("*").remove();
        this.regionContainer.selectAll("div")
            .data(allRegions)
            .join(enter => enter.append("div")
                    .attr("regionID", d => RegionPicker.divRegionID(d.ID))
                    .text(d => d.name)
                    .style("margin-left", function (region, index){
                        return (index === 0) ? "20px" : 0;
                    })
                    .style("margin-right", function (region, index){
                        return (index === allRegions.length - 1) ? "20px" : "20px";
                    })
                    .on("click", function (clickedRegion) {
                        thisPicker._didClickTokenForRegion(clickedRegion);
                    }),
                update => update.attr("class", d => thisPicker._buttonClassForRegion(d))
            );

        this.sectionTitleContainer.selectAll("*").remove();
        this.sectionTitleContainer.selectAll("div")
            .data(this.regionSections)
            .join(function(enter) {
                return enter.append("div")
                    .attr("sectionID", d => RegionPicker.divSectionID(d.ID))
                    .attr("class", "region-section-title")
                    .text(d => d.name)
                    .on("click", function (clickedSectionTitle) {
                        thisPicker._didClickSection(clickedSectionTitle);
                    })
                    .clone()
                    .attr("sectionID", null)
                    .attr("placeholderID", d => RegionPicker.divPlaceholderID(d.ID))
                    .text(d => d.name)
                    .style("display", "none")
                    .style("opacity", 0.0);
            });

        this._updateActiveRegionDisplay();
        this._computeSectionLayout();
        this._layoutSectionTitles();
    }

    _computeSectionLayout() {

        let newSectionRanges = [];
        let firstTokenNode = this.regionContainer.selectAll("div").first().node();
        this.leftMargin = firstTokenNode.offsetLeft;
        let thisPicker = this;
        this.regionSections.forEach(function (regionSection) {
            let firstRegion = regionSection.regions[0];
            let lastRegion = regionSection.regions[regionSection.regions.length - 1];

            let firstRegionButton = thisPicker._regionNodeForRegionID(firstRegion.ID);
            let lastRegionButton = thisPicker._regionNodeForRegionID(lastRegion.ID);
            let sectionTitle = thisPicker._titleNodeForSection(regionSection);

            let leftOfFirstRegion = firstRegionButton.offsetLeft;
            let rightOfLastRegion = lastRegionButton.offsetLeft + lastRegionButton.offsetWidth;
            let fixedEnterScrollOffset = leftOfFirstRegion - thisPicker.leftMargin;
            let fixedExitScrollOffset = rightOfLastRegion - (sectionTitle.offsetWidth + thisPicker.leftMargin);

            let leftTransform = "translateX(" + (leftOfFirstRegion - sectionTitle.offsetLeft) + "px)";
            let rightTransform = "translateX(" + (rightOfLastRegion - sectionTitle.offsetWidth - sectionTitle.offsetLeft) + "px)";
            sectionTitle.style.transform = leftTransform;

            newSectionRanges.push({
                fixedEnterScrollOffset:fixedEnterScrollOffset,
                fixedExitScrollOffset:fixedExitScrollOffset,
                leftTransform:leftTransform,
                rightTransform: rightTransform
            });
        });

        this.sectionRanges = newSectionRanges;
    }

    _regionNodeForRegionID(regionID) {
        return this.regionContainer.select("div[regionID=" + RegionPicker.divRegionID(regionID) + "]").node();
    }

    _titleNodeForSection(section) {
        return this.sectionTitleContainer.select("div[sectionID=" + RegionPicker.divSectionID(section.ID) + "]").node();
    }

    _placeholderNodeForSection(section) {
        return this.sectionTitleContainer.select("div[placeholderID=" + RegionPicker.divPlaceholderID(section.ID) + "]").node();
    }

    _fixSection(section, index) {
        // console.log("fixing section " + index);
        let title = this._titleNodeForSection(section);
        title.style.position = "absolute";
        title.style.left = this.leftMargin.toString() + "px";
        title.style.transform = "none";
        title.classList.add("active");

        let placeholder = this._placeholderNodeForSection(section);
        placeholder.style.display = "unset";

        this.fixedSectionIndex = index;
    }

    _unfixSection(section, transform, nextHighlightIndex) {
        // console.log("unfixing section");
        let title = this._titleNodeForSection(section);
        title.style.position = "unset";
        title.style.left = "unset"
        title.style.transform = transform;

        let placeholder = this._placeholderNodeForSection(section);
        placeholder.style.display = "none";

        if (nextHighlightIndex >= 0 && nextHighlightIndex < this.regionSections.length) {
            // Only unhighlight if we're highlighting something else (handles rubberbanding cases)
            title.classList.remove("active");
            let nextSection = this.regionSections[nextHighlightIndex];
            this._titleNodeForSection(nextSection).classList.add("active");
        }

        this.fixedSectionIndex = -1;
    }

    _layoutSectionTitles() {
        let thisPicker = this;
        let currentOffset = this.container.node().scrollLeft;
        this.regionSections.forEach(function (regionSection, i) {
            let sectionRange = thisPicker.sectionRanges[i];
            if (currentOffset >= sectionRange.fixedEnterScrollOffset
                && currentOffset <= sectionRange.fixedExitScrollOffset) {
                //We need to be fixed in this case
                if (thisPicker.fixedSectionIndex !== i) {
                    thisPicker._fixSection(regionSection, i);
                }
            } else if (thisPicker.fixedSectionIndex === i){
                // We need to unfix
                let newTransform = null;
                let nextHighlightIndex = null;
                if (currentOffset < sectionRange.fixedEnterScrollOffset) {
                    newTransform = sectionRange.leftTransform;
                    nextHighlightIndex = i - 1;
                } else if (currentOffset > sectionRange.fixedExitScrollOffset) {
                    newTransform = sectionRange.rightTransform;
                    nextHighlightIndex = i + 1;
                } else {
                    debugger;
                }
                thisPicker._unfixSection(regionSection, newTransform, nextHighlightIndex);
            }
        });
    }

    selectRegionWithID(regionID) {
        this.activeRegion = regionID;

        // Re-draw regions for updated styling
        if (this.regions !== undefined) {
            this._updateActiveRegionDisplay();
        }

        let activeRegionDiv = this._regionNodeForRegionID(regionID);
        if (activeRegionDiv !== null) {
            let scrollSelection = this.container;
            let scrollElement = scrollSelection.node();
            let leftEdgeScrollOffset = scrollElement.scrollLeft;
            let viewportSize = scrollElement.offsetWidth;
            let rightEdgeScrollOffset = leftEdgeScrollOffset + viewportSize;
            let activeTokenLeft = activeRegionDiv.offsetLeft;
            let activeTokenRight = activeRegionDiv.offsetLeft + activeRegionDiv.offsetWidth;
            let isTooFarLeft = !(activeTokenLeft > leftEdgeScrollOffset);
            let isRightVisible = activeTokenRight < rightEdgeScrollOffset;
            let isTooFarRight = !(activeTokenLeft < rightEdgeScrollOffset) || !isRightVisible;

            if (isTooFarLeft || isTooFarRight) {
                // Use these for default margins on left and right
                let firstTokenNode = this.regionContainer.selectAll("div").first().node();
                let lastTokenNode = this.regionContainer.selectAll("div").last().node();
                let leftMargin = firstTokenNode.offsetLeft;
                let rightMargin =  scrollElement.scrollWidth - (lastTokenNode.offsetLeft + lastTokenNode.offsetWidth);

                let correctiveOffset = isTooFarLeft ? (activeTokenLeft - leftMargin)
                    : (activeTokenRight + rightMargin - viewportSize);

                scrollSelection.transition()
                    .duration(REGION_TRANSITION_DURATION)
                    .tween("ResetRegionPicker", scrollLeftTween(correctiveOffset));
            }
        }
    }

    _didClickSection(regionSection) {
        console.log("clicked section " + regionSection.name);
    }

    _didScroll() {
        this._layoutSectionTitles();
    }

    _didClickTokenForRegion(region) {
        console.log("picked region " + region.name);
        if (this.onRegionClicked) {
            this.onRegionClicked(region);
        }
    }

    _buttonClassForRegion(region) {
        let result = "region-button";
        if (this.activeRegion === region.ID) {
            result += " active";
        }
        return result;
    }

    static divRegionID(regionID) {
        return "regionToken" + regionID;
    }

    static divSectionID(sectionID) {
        return "sectionToken" + sectionID;
    }

    static divPlaceholderID(sectionID) {
        return "placeholderToken" + sectionID;
    }
}