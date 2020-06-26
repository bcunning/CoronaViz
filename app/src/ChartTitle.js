import { REGION_TRANSITION_DURATION } from "./Constants.js";

export default class ChartTitle {
    constructor(parentElementSelection) {
        let thisTitle = this;
        this.parent = parentElementSelection;
        this.container = parentElementSelection.append("div").attr("class", "robo-text-title base-chart-container content-column unselectable");
        this.statAdjective = this.container.append("b")
            .attr("class", "tappable")
            .on("click", function() {
                thisTitle._didTapStatAdjective();
            });
        this.metricDescription = this.container.append("b");
        this.regionPreposition = this.container.append("div").attr("class", "robo-text");
        this.regionDescription = this.container.append("b")
            .attr("class", "tappable")
            .on("click", function() {
                thisTitle._didTapRegionDescription();
            });
        this.groupByClause = this.container.append("div").attr("class", "robo-text").text(", by ");
        this.groupByNoun = this.container.append("div").attr("class", "robo-text").text("day");

        this.didTapStatAdjective = null;
        this.didTapRegionDescription = null;
    }

    updateForContextChange(newEvaluator, newRegion, newGroupByUnit, animated = true) {
        this.evaluator = newEvaluator;
        this.region = newRegion;
        this.groupByUnit = newGroupByUnit;
        this._updateText(animated);
    }

    _updateText(animated = false) {

        // Don't animate if we haven't been populated with anything yet
        if (animated && this.metricDescription.text().length > 0) {
            let paddingHeight = parseInt(this.container.style("padding-bottom").replace("px", ""));
            let currentHeight = this.container.node().offsetHeight - paddingHeight;
            this.container.style("height", currentHeight + "px");

            // Create a temporary title for dynamic sizing
            let sizingTitle = new ChartTitle(this.parent);
            sizingTitle.updateForContextChange(this.evaluator, this.region, this.groupByUnit, false);
            let targetHeight = sizingTitle.container.node().offsetHeight - paddingHeight;
            sizingTitle.container.remove();

            // Resize according to the new height
            if (targetHeight > currentHeight && Math.abs(currentHeight - targetHeight) > 3) {
                this.container.transition()
                    .duration(REGION_TRANSITION_DURATION)
                    .style("height", targetHeight + "px");
            }
        }

        this.statAdjective.text(this.evaluator.statDescription().capitalize());
        this.metricDescription.text(' ' + this.evaluator.noun + ' ');
        this.regionPreposition.text(this.region.prepositionString());
        this.regionDescription.text(this.region.plainEnglishNameWithArticle());
        if (this.evaluator.needsGroupBy()) {
            this.groupByClause.text(", by ");
            this.groupByNoun.text(this.groupByUnit);
        } else {
            this.groupByClause.text("");
            this.groupByNoun.text("");
        }
    }

    _didTapRegionDescription() {
        if (this.didTapRegionDescription) {
            this.didTapRegionDescription(this.region);
        }
    }

    _didTapStatAdjective() {
        if (this.didTapStatAdjective) {
            this.didTapStatAdjective(this);
        }
    }
}