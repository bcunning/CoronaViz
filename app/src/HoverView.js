import { format } from 'd3-format';
import { timeFormat } from 'd3-time-format';

import { ChartDrawMode } from "./ChartSegment.js";
import ChartSegment from "./ChartSegment.js";

export default class HoverView {
    constructor(parentElementSelection) {
        this.container = parentElementSelection.append("div").attr("class", "hover-container unselectable");
        let dateRow = this.container.append("div").attr("class", "hover-title-row");
        this.dateText = dateRow.append("div").attr("class", "hover-date-text");

        let contentRow = this.container.append("div").attr("class", "hover-row");

        this.primaryColumn = contentRow.append("div").attr("class", "hover-column-left");
        this.rowOnePrimaryText = this.primaryColumn.append("div").attr("class", "hover-primary-text");
        this.rowTwoPrimaryText = this.primaryColumn.append("div").attr("class", "hover-primary-text");

        this.secondaryColumn = contentRow.append("div").attr("class", "hover-column-right");
        this.rowOneSecondaryText = this.secondaryColumn.append("div").attr("class", "hover-secondary-text");
        this.rowTwoSecondaryText = this.secondaryColumn.append("div").attr("class", "hover-secondary-text");

        this.dateFormatter = timeFormat("%B %e");
        this.bigNumberFormatter = format(".2s");
        this.smallNumberFormatter = format(".2");
        this.numberFormatter = format(".3");
    }

    _formatterForValue(value, evaluator) {
        if (evaluator.valueFormatter !== null) {
            return evaluator.valueFormatter;
        }

        let magnitude = Math.abs(value);
        if (magnitude >= 1000) {
            return this.bigNumberFormatter;
        }

        if (magnitude < 100) {
            return this.smallNumberFormatter;
        }

        return this.numberFormatter;
    }

    updateForSnapshots(snapshots, rawEvaluator, smoothedEvaluator, drawMode = ChartDrawMode.Default) {
        let snapshot = snapshots[0];

        let needsBottomRow = true;
        let dateText = this.dateFormatter(snapshot.normalizedDate());

        let topEvaluator = rawEvaluator;
        let topValue = topEvaluator.valueForSnapshot(snapshot);
        let topFormatter = this._formatterForValue(topValue, topEvaluator);

        let topNoun = topEvaluator.graphedNoun();

        let bottomEvaluator = smoothedEvaluator;
        let bottomValue = bottomEvaluator.valueForSnapshot(snapshot);
        let bottomFormatter = this._formatterForValue(bottomValue, bottomEvaluator);
        let bottomNoun = bottomEvaluator.graphedNoun();

        let valuePrefix = "";

        if (snapshots.length > 1) {
            let secondSnapshot = snapshots[1];
            let secondDateFormatter = this.dateFormatter;
            let spacer = "&nbsp;";
            if (snapshot.dateOnlyDiffersInDay(secondSnapshot)) {
                secondDateFormatter = timeFormat("%e");
                spacer = "";
            }

            needsBottomRow = !(smoothedEvaluator.displayAsPercent || smoothedEvaluator.normalized)
            dateText = dateText + spacer + "&ndash;" + spacer + secondDateFormatter(secondSnapshot.normalizedDate());

            let firstValue = smoothedEvaluator.valueForSnapshot(snapshot);
            let secondValue = smoothedEvaluator.valueForSnapshot(secondSnapshot);
            let difference = secondValue - firstValue;
            valuePrefix = difference > 0 ? "+" : "";
            topValue = difference;
            topFormatter = this._formatterForValue(topValue, topEvaluator);
            bottomValue = firstValue === 0 ? 0 : (difference / firstValue);
            if (Math.sign(difference) != Math.sign(bottomValue)) {
                bottomValue *= -1;
            }
            bottomFormatter = format(".0%");

            topNoun = smoothedEvaluator.changeInGraphedNoun();
            bottomNoun = smoothedEvaluator.changeInGraphedNoun();
        }

        this.dateText.html(dateText);

        this.rowOnePrimaryText.text(valuePrefix + topFormatter(topValue));
        this.rowOneSecondaryText.text(topNoun);

        this.rowTwoPrimaryText.text(valuePrefix + bottomFormatter(bottomValue));
        this.rowTwoSecondaryText.text(bottomNoun);

        let primaryColor = "initial";
        if (drawMode !== ChartDrawMode.Default) {
            primaryColor = ChartSegment.colorForEvaluator(smoothedEvaluator, drawMode);
        }
        this.rowOnePrimaryText.style("color", primaryColor);
        this.rowTwoPrimaryText.style("color", primaryColor);

        this.rowTwoPrimaryText.style("display", needsBottomRow ? "unset" : "none");
        this.rowTwoSecondaryText.style("display", needsBottomRow ? "unset" : "none");
    }
}