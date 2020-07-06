import { select, event, touches } from 'd3-selection';
import { format } from 'd3-format';
import { timeFormat } from 'd3-time-format';
import {normalizeDate} from "./DateUtils";
import CopyLinkButton from "./CopyLinkButton";

export default class ChartDescription {
    constructor(parentElementSelection) {
        let thisDescription = this;

        this.container = parentElementSelection.append("div").attr("class", "robo-text-description content-column unselectable");
        this.container.text("Florida reported 781 new cases of COVID-19 on May 17. On average, new cases are down 17% week over week, and down 31% month over month.");
        this.container.on("touchstart", function () {
            thisDescription.touchDownElsewhere = true;
        }).on("touchend", function () {
            thisDescription.touchDownElsewhere = false;
        });

        this.dataQuantityHover = null;
        this.monthChangeHover = null;
        this.weekChangeHover = null;
        this.touchDownElsewhere = false;

        this.didHoverDates = null;

        this.percentFormatter = format(".0%");
        this.defaultFormatter = format(",");
        this.dateFormatter = timeFormat("%B %e");
    }

    noDataHTML(evaluator, region) {
        return "There is no data available for this region."
    }

    updateForData(data, region, evaluator, averageEvaluator) {

        if (data.length === 0) {
            this.container.html(this.noDataHTML(evaluator, region));
            return;
        }

        this.data = data;
        this.currentSnapshot = data[data.length - 1];
        this.weekAgoSnapshot = data[data.length - 1 - 7];
        this.monthAgoSnapshot = data[data.length - 1 - 30];
        this.region = region;
        this.evaluator = evaluator;
        this.averageEvaluator = averageEvaluator;

        this.container.html(this.htmlForTemplate(evaluator.descriptionTemplate));
        this.copyLinkButton = new CopyLinkButton(this.container, evaluator);
        this._updateHovers();
    }

    _hoverDates(dates, hoverElement = null) {
        // Don't hover if we've touched somewhere else first (as in text selection)
        if (this.touchDownElsewhere) {
            return;
        }

        dates = dates.map(d => normalizeDate(d));

        if (hoverElement !== null) {
            let currentTouches = touches(hoverElement);
            if (currentTouches.length > 0) {
                event.stopPropagation();
            }
        }

        if (this.didHoverDates !== null) {
            this.didHoverDates(dates);
        }
    }

    _updateHovers() {
        let thisDescription = this;

        this.dataQuantityHover = this.container.select("#" + this._dataQuantityID());
        this.dataQuantityHover.on("mouseenter touchstart", function () {
            thisDescription._hoverDates([thisDescription.currentSnapshot.normalizedDate()], this);
        });
        this.dataQuantityHover.on("mouseleave touchend", function () {
            thisDescription._hoverDates([]);
        });

        this.weekChangeHover = this.container.select("#" + this._weekChangeID());
        this.weekChangeHover.on("mouseenter touchstart", function () {
            thisDescription._hoverDates([thisDescription.weekAgoSnapshot.normalizedDate(),
                thisDescription.currentSnapshot.normalizedDate()], this);
        });
        this.weekChangeHover.on("mouseleave touchend", function () {
            thisDescription._hoverDates([]);
        });

        this.monthChangeHover = this.container.select("#" + this._monthChangeID());
        this.monthChangeHover.on("mouseenter touchstart", function () {
            thisDescription._hoverDates([thisDescription.monthAgoSnapshot.normalizedDate(),
                thisDescription.currentSnapshot.normalizedDate()], this);
        });
        this.monthChangeHover.on("mouseleave touchend", function () {
            thisDescription._hoverDates([]);
        });
    }

    _dataQuantityID() {
        return "DataQuantity";
    }

    _monthChangeID() {
        return "MonthChange";
    }

    _weekChangeID() {
        return "WeekChange";
    }

    _tokenIteratorFromTemplate(templateString) {
        return templateString.matchAll(/<Token:([A-Za-z]+)>/g);
    }

    _hoverDivForValue(value, ID) {
        return "<span class=\"robo-description-hover unselectable\" id=\"" + ID + "\">" + value + "</span>";
    }

    _formatDataQuantity(value, evaluator) {
        let formatter = (evaluator.valueFormatter !== null) ? evaluator.valueFormatter : this.defaultFormatter;
        return formatter(value);
    }

    _formatShortDate(date) {
        let dateFormatter = this.dateFormatter;
        return dateFormatter(date);
    }

    _percentChangeFromSnapshot(oldSnapshot) {
        let secondValue = this.averageEvaluator.valueForSnapshot(this.currentSnapshot);
        if (oldSnapshot === undefined) {
            if (secondValue === 0) {
                return 0
            } else if (secondValue > 0) {
                return 1;
            } else {
                return -1;
            }
        }
        let firstValue = this.averageEvaluator.valueForSnapshot(oldSnapshot);
        let difference = secondValue - firstValue;
        let result = firstValue === 0 ? 0 : (difference / firstValue);
        if (Math.sign(difference) != Math.sign(result)) {
            result *= -1;
        }
        return result;
    }

    _amountChangeFromSnapshot(oldSnapshot) {
        if (oldSnapshot === undefined) {
            return 0;
        }
        let firstValue = this.averageEvaluator.valueForSnapshot(oldSnapshot);
        let secondValue = this.averageEvaluator.valueForSnapshot(this.currentSnapshot);
        let result = secondValue - firstValue;
        return result;
    }

    _formatPercentChange(percentChange) {
        let formatter = this.percentFormatter;
        return formatter(percentChange);
    }

    _formattedPercentChangeFromSnapshot(oldSnapshot) {
        let percentChange = this._percentChangeFromSnapshot(oldSnapshot);
        return this._formatPercentChange(percentChange);
    }

    _formattedAmountChangeFromSnapshot(oldSnapshot) {
        let difference = this._amountChangeFromSnapshot(oldSnapshot);
        return this._formatDataQuantity(difference, this.averageEvaluator);
    }

    _directionStringForChange(change) {
        if (change === 0) {
            return "flat";
        }
        return (change > 0) ? "up" : "down";
    }

    _changeVerbForChange(change, presentTense = false) {
        if (presentTense) {
            if (change === 0) {
                return "have remained constant";
            }
            return (change > 0) ? "are increasing" : "are decreasing";
        } else {
            // if (change === 0) {
            //     return "remained flat";
            // }
            return (change > 0) ? "increased by" : "decreased by";
        }
    }

    _evaluateToken(tokenType) {
        switch (tokenType) {
            case "Region":
                return this.region.plainEnglishNameWithArticle();
                break;
            case "RegionPreposition":
                return this.region.prepositionString();
                break;
            case "ReportingVerb":
                return this.evaluator.reportingVerb();
                break;
            case "DataQuantity": {
                let quantity = this.evaluator.valueForSnapshot(this.currentSnapshot);
                let formattedValue = this._formatDataQuantity(quantity, this.evaluator);
                return this._hoverDivForValue(formattedValue, this._dataQuantityID());
                break;
            }
            case "DataQuantityDirection": {
                let quantity = this.evaluator.valueForSnapshot(this.currentSnapshot);
                return this._directionStringForChange(quantity);
            }
            case "FullyQualifiedNoun":
                return this.evaluator.fullyQualifiedNoun();
                break;
            case "TimePreposition":
                return this.evaluator.measureDelta ? "on" : "as of";
                break;
            case "ShortDate":
                return this._formatShortDate(this.currentSnapshot.normalizedDate());
                break;
            case "CumulativeSignifier":
                return this.evaluator.measureDelta ? "" : "all ";
                break;
            case "Noun":
                return this.evaluator.noun;
                break;
            case "NounIs":
                return this.evaluator.dataIsAtomic() ? "are" : "is";
                break;
            case "DirectionDescriptionWeek": {
                let weekChange = this._percentChangeFromSnapshot(this.weekAgoSnapshot);
                return this._directionStringForChange(weekChange);
                break;
            }
            case "ChangeVerbCurrent": {
                let quantity = this.evaluator.valueForSnapshot(this.currentSnapshot);
                return this._changeVerbForChange(quantity);
                break;
            }
            case "ChangeVerbWeek": {
                return this._changeVerbForChange(this._amountChangeFromSnapshot(this.weekAgoSnapshot));
                break;
            }
            case "ChangeVerbWeekProgressive": {
                return this._changeVerbForChange(this._amountChangeFromSnapshot(this.weekAgoSnapshot), true);
                break;
            }
            case "PercentChangeWeek": {
                let formattedWeekChange = this._formattedPercentChangeFromSnapshot(this.weekAgoSnapshot);
                return this._hoverDivForValue(formattedWeekChange, this._weekChangeID());
                break;
            }
            case "DirectionalPercentChangeWeek": {
                let weekChange = this._percentChangeFromSnapshot(this.weekAgoSnapshot);
                let direction = this._directionStringForChange(weekChange);
                if (weekChange === 0) {
                    return this._hoverDivForValue(direction, this._weekChangeID());
                }
                return direction + " " + this._evaluateToken("PercentChangeWeek");
                break;
            }
            case "AmountChangeWeek": {
                let formattedWeekAmountChange = this._formattedAmountChangeFromSnapshot(this.weekAgoSnapshot);
                return this._hoverDivForValue(formattedWeekAmountChange, this._weekChangeID());
                break;
            }
            case "DirectionDescriptionMonth": {
                let monthChange = this._percentChangeFromSnapshot(this.monthAgoSnapshot);
                return this._directionStringForChange(monthChange);
                break;
            }
            case "ChangeVerbMonth": {
                return this._changeVerbForChange(this._amountChangeFromSnapshot(this.monthAgoSnapshot));
                break;
            }
            case "PercentChangeMonth": {
                let formattedMonthChange = this._formattedPercentChangeFromSnapshot(this.monthAgoSnapshot);
                return this._hoverDivForValue(formattedMonthChange, this._monthChangeID());
                break;
            }
            case "DirectionalPercentChangeMonth": {
                let monthChange = this._percentChangeFromSnapshot(this.monthAgoSnapshot);
                let direction = this._directionStringForChange(monthChange);
                if (monthChange === 0) {
                    return this._hoverDivForValue(direction, this._monthChangeID());
                }
                return direction + " " + this._evaluateToken("PercentChangeMonth");
                break;
            }
            case "AmountChangeMonth": {
                let formattedMonthAmountChange = this._formattedAmountChangeFromSnapshot(this.monthAgoSnapshot);
                return this._hoverDivForValue(formattedMonthAmountChange, this._monthChangeID());
                break;
            }
        }

        return "";
    }

    _stringByEvaluatingTokens(tokenIterator, templateString) {
        let result = templateString;
        let tokenResult = tokenIterator.next();
        while (!tokenResult.done) {
            let token = tokenResult.value;
            let fullToken = token[0];
            let tokenType = token[1];
            let index = token.index;

            let evaluated = this._evaluateToken(tokenType);
            if (index === 0) {
                evaluated = evaluated.capitalize();
            }
            result = result.replace(fullToken, evaluated);

            tokenResult = tokenIterator.next();
        }

        return result;
    }

    htmlForTemplate(template) {
        let tokenIterator = this._tokenIteratorFromTemplate(template);
        return this._stringByEvaluatingTokens(tokenIterator, template);
    }
}