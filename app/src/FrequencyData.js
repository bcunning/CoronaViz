export default class FrequencyData {
    constructor(sortedSeries, maxJump) {
        this.series = sortedSeries;
        this.maxJump = maxJump;

        if (sortedSeries === null || sortedSeries.length === 0) {
            return;
        }

        let minIndex = 0;
        let maxIndex = sortedSeries.length - 1;
        let medianIndex = Math.round(maxIndex / 2.0);
        let bottomQuartileIndex = Math.round(maxIndex / 4.0);
        let topQuartileIndex = Math.round((3.0 / 4.0) * maxIndex);

        this.min = sortedSeries[minIndex][1];
        this.max = sortedSeries[maxIndex][1];
        this.bottomQuartile = sortedSeries[bottomQuartileIndex][1];
        this.median = sortedSeries[medianIndex][1];
        this.topQuartile = sortedSeries[topQuartileIndex][1];
    }

    maxValueBelowValue(value) {
        let low = -1;
        let high = this.series.length;
        while (1 + low < high) {
            let mid = low + ((high - low) >> 1);
            if (this.series[mid][1] > value) {
                high = mid;
            } else {
                low = mid;
            }
        }
        let result = this.series[high][1];
        return result;
    }
}