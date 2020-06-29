import {event} from "d3-selection";

export default class NavControl {
    constructor(parentElementSelection, isStandalone = false) {
        let thisNav = this;
        let standaloneSuffix = isStandalone ? " standalone" : "";
        this.container = isStandalone ? parentElementSelection : parentElementSelection.append("div").attr("class", "nav-control" + standaloneSuffix);
        this.backButton = this.container.append("div")
            .attr("class", "back-button" + standaloneSuffix)
            .on("touchstart", function(){
                this._touchDidMove = false;
            })
            .on("touchmove", function() {
                thisNav._touchDidMove = true;
            })
            .on("touchend", function() {
                if (!thisNav._touchDidMove) {
                    thisNav._backButtonClicked();
                    event.preventDefault();
                }
            })
            .on("click", function() {
                thisNav._backButtonClicked();
                event.preventDefault();
            });

        this._touchDidMove = false;
        this.titleSelection = null;
        this.didClickBackButton = null;
        this._backButtonVisible = true;
        this.setBackButtonVisible(false, false);
    }

    setBackButtonVisible(visible, animated = true) {
        if (visible !== this._backButtonVisible) {
            this.backButton.style("display", visible ? "flex" : "none");
            this._backButtonVisible = visible;
        }
    }

    _backButtonClicked() {
        if (this.didClickBackButton !== null) {
            this.didClickBackButton();
        }
    }
}