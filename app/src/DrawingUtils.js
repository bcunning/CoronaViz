import FrequencyData from "./FrequencyData.js";
import ScaleParameters from "./ScaleParameters.js";
import {ChartDisplayMode} from "./OverTimeVisualization.js"

export default class DrawingUtils {
    static frequencyDataForSeries(dataSeries) {

        if (dataSeries.length === 0) {
            return new FrequencyData(null, 0);
        }

        // Find max discontinuity
        let maxDiscontinuity = 0;
        for (let i = 0; i < dataSeries.length - 1; i++) {
            let value = dataSeries[i][1];
            let nextValue = dataSeries[i + 1][1];
            let difference = nextValue - value;
            if (Math.abs(difference) > Math.abs(maxDiscontinuity)) {
                maxDiscontinuity = difference;
            }
        }

        // Sort by the top of the data (note this isn't actually comparing the "value", which would be d[1] - d[0]
        // It's comparing the visual peak instead.
        let sortedSeries = dataSeries.concat().sort(function (d1, d2) {
            return (d1[1] - d2[1]);
        });

        return new FrequencyData(sortedSeries, maxDiscontinuity);
    }

    static scaleParametersForSeries(displayMode, allRawSeries, allTrendLineSeries, normalized, allowNegativeNumbers) {
        let allRawData = [];
        allRawSeries.forEach(function (series) {
            allRawData = allRawData.concat(series.data);
        })
        let allTrendData = [];
        allTrendLineSeries.forEach(function (series) {
            allTrendData = allTrendData.concat(series.data);
        })

        return DrawingUtils.scaleParametersForData(displayMode, allRawData, allTrendData, normalized, allowNegativeNumbers);
    }

    static scaleParametersForData(displayMode, rawDataSeries, trendLineDataSeries, normalized, allowNegativeNumbers) {

        let rawFrequencyData = DrawingUtils.frequencyDataForSeries(rawDataSeries);
        let trendLineFrequencyData = DrawingUtils.frequencyDataForSeries(trendLineDataSeries);

        // In mini display mode, only use trend line to determine scale.
        // Don't support scale truncation in this mode.
        if (displayMode !== ChartDisplayMode.Full) {
            return new ScaleParameters(trendLineFrequencyData.min, trendLineFrequencyData.max, false);
        }

        let result = new ScaleParameters(rawFrequencyData.min, rawFrequencyData.max, false);

        // Bail out on the negative case til we need it
        if (allowNegativeNumbers) {
            return result;
        }

        let maxRawToAverageFactor = 1.9;
        let rawHeadroomFactor = 1.5;
        let maxPeakAverageToTopQuartileFactor = 2.2;
        if (rawFrequencyData.max > trendLineFrequencyData.max * maxRawToAverageFactor) {
            result.useOvershoot = true;
            result.yMax = trendLineFrequencyData.max * rawHeadroomFactor;
            result.yDataMax = rawFrequencyData.maxValueBelowValue(result.yMax);
        } else {
            let maxJumpsAboveTopQuart = (trendLineFrequencyData.max > trendLineFrequencyData.topQuartile * maxPeakAverageToTopQuartileFactor);
            let jumpsMoreThanHalf = Math.abs(trendLineFrequencyData.maxJump) > 0.5 * trendLineFrequencyData.max;
            if (maxJumpsAboveTopQuart && jumpsMoreThanHalf) {
                result.useOvershoot = true;
                result.yMax = trendLineFrequencyData.topQuartile * maxPeakAverageToTopQuartileFactor;
                result.yDataMax = rawFrequencyData.maxValueBelowValue(result.yMax);
            }
        }
        return result;
    }
}