import {timeFormat} from "d3-time-format";
import {dateStringFromDate, denormalizeDate, shortDateStringFromDate} from "./DateUtils";

export default class DateSelector {
    constructor(parentElementSelection, textAlign = "center", isStandalone = false) {
        let thisSelector = this;
        this.container = parentElementSelection.append("h2")
            .attr("class", "date-subtitle header-subtitle-element" + (isStandalone ? " standalone" : ""))
            .style("text-align", textAlign);
        let explanation = this.container.append("span")
            .attr("class", "date-intro")
            .text("Update for: ");
        if (isStandalone) {
            explanation.style("display", "none");
        }
        this.yesterdayButton = this.container.append("span")
            .attr("class", "date-unselected")
            .text("Yesterday")
            .on("click", function () { thisSelector._didClickDate(this); });
        let divider = this.container.append("span")
            .attr("class", "date-divider")
            .text(" | ");
        this.todayButton = this.container.append("span")
            .attr("class", "date-selected")
            .text("Now")
            .on("click", function () { thisSelector._didClickDate(this); });

        this.selectedButton = this.todayButton;
        this.dateFormatter = timeFormat("%B %e");
        this.today = null;
        this.onDateChanged = null;
    }

    _didClickDate(dateElement) {
        if (dateElement === this.yesterdayButton.node()) {
            this._setLatest(false);
        } else if (dateElement === this.todayButton.node()) {
            this._setLatest(true);
        }
    }

    isLatest() {
        return (this.selectedButton === this.todayButton);
    }

    mostRecentDataIsFromToday() {
        let rightNow = new Date();
        // Count 3AM as "today" still.
        let threeHoursAgo = denormalizeDate(rightNow.addHours(-3));
        return shortDateStringFromDate(threeHoursAgo) == shortDateStringFromDate(this.today);
    }

    yesterday() {
        return this.today.addDays(-1);
    }

    _setLatest(isLatest, setExternally = false) {
        let newSelectedButton = isLatest ? this.todayButton : this.yesterdayButton;
        if (newSelectedButton !== this.selectedButton) {
            this.selectedButton = newSelectedButton;

            this.todayButton.attr("class", isLatest ? "date-selected" : "date-unselected");
            this.yesterdayButton.attr("class", isLatest ? "date-unselected" : "date-selected");

            if (this.onDateChanged !== null && !setExternally) {
                let date = isLatest ? this.today : this.yesterday();
                let dateString = dateStringFromDate(date);
                this.onDateChanged(dateString);
            }
        }
    }

    setDate(day) {
        if (this.today === null) {
            this.setToday(day);
        } else {
            this._setLatest(day.getTime() === this.today.getTime(), true);
        }
    }

    setToday(today) {
        this.today = today;
        this.todayButton.text(this.dateFormatter(today));
        // Only use "Yesterday" if it makes sense relative to the client date.
        this.yesterdayButton.text(this.mostRecentDataIsFromToday() ? "Yesterday" : this.dateFormatter(this.yesterday()));
    }
}