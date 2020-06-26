import { ChartDrawMode } from "./ChartSegment.js";
import ChartSegment from "./ChartSegment.js";

export default class HoverBarHighlight {
    constructor(parentElementSelection, evaluator, rawBlipWidth, rawBlipHeight) {
        this.drawMode = -1;
        this.evaluator = evaluator;
        this.hoverLine = parentElementSelection.append("line")
            .style("stroke-width", 2);
        this.hoverRawBlip = parentElementSelection.append("rect")
            .attr("height", rawBlipHeight)
            .attr("width", rawBlipWidth);
        this.hoverBlip = parentElementSelection.append("circle")
            .style("stroke", "white")
            .style("stroke-width", 2)
            .attr("r", 5);

        this.setDrawMode(ChartDrawMode.Default);
    }

    setDrawMode(drawMode) {
        if (drawMode !== this.drawMode) {
            this.drawMode = drawMode;

            this.hoverLine.style("stroke", this.fillColor());
            this.hoverRawBlip.attr("fill", this.fillColor());
            this.hoverBlip.attr("fill", this.fillColor());
        }
    }

    fillColor() {
        return ChartSegment.colorForEvaluator(this.evaluator, this.drawMode);
    }

    setShowRawBlip(shouldShow) {
        this.hoverRawBlip.style("display", shouldShow ? "unset" : "none");
    }

    remove() {
        this.hoverLine.remove();
        this.hoverBlip.remove();
        this.hoverRawBlip.remove();
    }

    setBlipCoordinate(x, y) {
        this.hoverBlip.attr("cx", x)
            .attr("cy", y);
    }

    setRawBlipCoordinate(x, y) {
        this.hoverRawBlip.attr("x", x)
            .attr("y", y);
    }

    setLineCoordinates(x1, y1, x2, y2) {
        this.hoverLine.attr("x1", x1)
            .attr("y1", y1)
            .attr("x2", x2)
            .attr("y2", y2);
    }
}