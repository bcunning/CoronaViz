import { CASE_DATA_COLOR } from "./Evaluator.js";
import { DEATH_DATA_COLOR } from "./Evaluator.js";
import { TEST_DATA_COLOR } from "./Evaluator.js";

export const ChartDrawMode = {
    Default: 0,
    Negative: 1,
    Positive: 2,
    Inactive: 3,
};

export default class ChartSegment {
    constructor(beginIndex, endIndex, drawMode, chartRange) {
        this.beginIndex = beginIndex;
        this.endIndex = endIndex;
        this.drawMode = drawMode;
        this.chartRange = chartRange;
    }

    contains(index) {
        let isOnEdge = (index === this.chartRange[0]) || (index === this.chartRange[1]);
        let inclusive = (this.drawMode !== ChartDrawMode.Inactive) || isOnEdge;
        let aboveBottom = inclusive ? (index >= this.beginIndex) : (index > this.beginIndex);
        let belowTop = inclusive ? (index <= this.endIndex) : (index < this.endIndex);
        return aboveBottom && belowTop;
    }

    static baseSegmentForData(data) {
        return new ChartSegment(0,
                                data.length,
                                ChartDrawMode.Default,
                                [0, data.length - 1]);
    }

    static colorForEvaluator(evaluator, drawMode = ChartDrawMode.Default, alpha = 1.0) {
        let rgbString = "0,0,0";
        switch (drawMode) {
            case ChartDrawMode.Default:
                return evaluator.baseColor(alpha)
            case ChartDrawMode.Negative:
                rgbString = CASE_DATA_COLOR;
                break;
            case ChartDrawMode.Positive:
                rgbString = TEST_DATA_COLOR;
                break;
            case ChartDrawMode.Inactive:
                rgbString = DEATH_DATA_COLOR;
                alpha *= 0.4;
                break;
        }

        return "rgba(" + rgbString + "," + alpha + ")";
    }
}