export default class NavControl {
    constructor(parentElementSelection, isStandalone = false) {
        let thisNav = this;
        let standaloneSuffix = isStandalone ? " standalone" : "";
        this.container = parentElementSelection.append("div").attr("class", "nav-control" + standaloneSuffix);
        this.backButton = this.container.append("div")
            .attr("class", "back-button" + standaloneSuffix)
            .on("click", function(){
            thisNav._backButtonClicked();
        });

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

    setTitleView(titleSelection) {
        this.titleSelection = titleSelection;
    }

    _backButtonClicked() {
        if (this.didClickBackButton !== null) {
            this.didClickBackButton();
        }
    }
}