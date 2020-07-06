import {select} from "d3-selection";

export default class CopyLinkButton {
    constructor(parentElementSelection, evaluator) {
        this.evaluator = evaluator;
        let weakThis = this;
        this.button = parentElementSelection.append("div").attr("class", "data-link")
            .style("display", "flex")
            .on("click", function() {
                weakThis.copyLinkToChart();
            });
        this.button.append("div").attr("class", "data-link-icon");
        this.copyButtonText = this.button.append("div").style("display", "inline").text(this._copyLinkString());
    }

    _copyLinkString() {
        return "Copy link to chart";
    }

    copyLinkToChart() {
        let url = window.location;
        let hash = "#" + this.evaluator.anchorNoun;
        let result = url.protocol + url.hostname + url.pathname + hash;

        let tempText = select("body").append("textarea").text(result);
        tempText.node().select();
        document.execCommand('copy');
        tempText.remove();

        console.log("Link copied: " + result);

        let weakThis = this;
        this.button.style("background", "rgba(0,0,0,0.035)");
        let textSelection = this.copyButtonText;
        textSelection.text("Copied");
        let resetString = this._copyLinkString();
        setTimeout(function () {
            textSelection.text(resetString);
            weakThis.button.style("background", "unset");
        }, 10000);
    }
}