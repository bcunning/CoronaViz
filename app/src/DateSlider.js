import {normalizeDate, shortDateStringFromDate} from "./DateUtils";

export default class DateSlider {
    constructor(parentElementSelection, dateRange, evaluator) {
        this.container = parentElementSelection.append("div").attr("class", "slide-container");
        this._annotationContainer = this.container.append("div")
            .style("display", "flex")
            .style("justify-content", "space-between")
            .style("margin-bottom", "0.3em");
        this.leftDateLabel = this._annotationContainer.append("span").attr("class", "slider-label").text("Feb 26");
        this.rightDateLabel = this._annotationContainer.append("span").attr("class", "slider-label").text("April 16");
        this._sliderSelection = this.container
            .append("input")
            .attr("type", "range")
            .attr("min", "0")
            .attr("max", "100")
            .attr("value", "0")
            .attr("class", "slider")
            .attr("id", "rangeSlider");
        this._dateInputSlider = this._sliderSelection.node();

        this.isBeingDragged = false;
        this.onSliderValueChanged = null;
        this._evaluator = evaluator;
        this.setDateRange(dateRange);

        let thisSlider = this;
        this._dateInputSlider.oninput = function (inputEvent) {
            thisSlider._didInput(inputEvent);
        };
    }

    _didInput(inputEvent) {
        this.isBeingDragged = true;
        if (this.onSliderValueChanged) {
            this.onSliderValueChanged(parseFloat(inputEvent.target.value) / 100.0); // Issue callback as a percent
        }
        this.isBeingDragged = false;
    }

    setDateRange(dateRange) {
        this.dateRange = [normalizeDate(dateRange[0]), normalizeDate(dateRange[1])];

        this.leftDateLabel.text(shortDateStringFromDate(this.dateRange[0]));
        this.rightDateLabel.text(shortDateStringFromDate(this.dateRange[1]));
    }

    updateSliderForStops(gradientStops) {
        return;
        let stopsString = "";
        let thisSlider = this;
        gradientStops.forEach(function(stop, index) {
            let color = thisSlider._evaluator.colorForSnapshot(stop.snapshot);
            let percent = Math.round(100 * stop.percent).toString() + "%";
            stopsString += color + " " + percent;
            if (index < gradientStops.length - 1) {
                stopsString += ", ";
            }
        });

        let gradientString = "linear-gradient(to right," + stopsString + ")";
        thisSlider._dateInputSlider.style.background = gradientString;
    }

    updateSliderForPercentComplete(percent) {
        this._dateInputSlider.value = 100 * percent;
    }
}