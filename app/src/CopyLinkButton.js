import {select} from "d3-selection";
import { createPopper } from '@popperjs/core';

export default class CopyLinkButton {
    constructor(parentElementSelection, evaluator) {
        this.evaluator = evaluator;
        let weakThis = this;
        this.parent = parentElementSelection;
        this.button = parentElementSelection.append("div").attr("class", "data-link")
            .style("display", "flex")
            .on("click", function() {
                weakThis.copyLinkToChart();
            });
        this.buttonIcon = this.button.append("div").attr("class", "data-link-icon");
        this.copyButtonText = this.button.append("div").style("display", "inline").text(this._copyLinkString());

        this.tooltipActive = false;
        this.toolTipSelection = null;
    }

    _copyLinkString() {
        return "Copy link to chart";
    }

    reset() {
        if (!this.tooltipActive) {
            return;
        }

        this.copyButtonText.text(this._copyLinkString());
        this.buttonIcon.attr("class", "data-link-icon");
        this.toolTipSelection.remove();

        this.tooltipActive = false;
        this.toolTipSelection = null;
    }

    copyLinkToChart() {
        if (this.tooltipActive) {
            this.reset();
            return;
        }

        this.tooltipActive = true;

        let url = window.location;
        let hash = "#" + this.evaluator.anchorNoun;
        let withoutProtocol = url.hostname + url.pathname + hash;
        let result = url.protocol + withoutProtocol;

        let tempText = select("body").append("textarea").text(result);
        tempText.node().select();
        document.execCommand('copy');
        tempText.remove();

        console.log("Link copied: " + result);

        this.copyButtonText.text("Copied");
        this.buttonIcon.attr("class", "data-confirmation-icon");

        this.toolTipSelection = this.parent.append("div")
                                    .attr("id", "tooltip")
                                    .attr("role", "tooltip")
                                    .text(withoutProtocol);
        this.toolTipSelection.append("div").attr("id", "arrow").attr("data-popper-arrow", "");

        createPopper(this.button.node(), this.toolTipSelection.node(), {
            placement: 'right',
            modifiers: [
                {
                    name: 'offset',
                    options: {
                        offset: [0, 8],
                    },
                },
                {
                    name: 'flip',
                    options: {
                        fallbackPlacements: ['bottom'],
                    },
                },
                {
                    name: 'preventOverflow',
                    options: {
                        rootBoundary: 'document',
                        padding: 20,
                    },
                },
            ],
        });

        let weakThis = this;
        setTimeout(function () {
            weakThis.reset();
        }, 6000);
    }
}