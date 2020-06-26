import StatColumn from "./StatColumn.js";

export default class StatDashboard {
    constructor(parentElementSelection, stats) {
        this.container = parentElementSelection.append("div").attr("class", "stat-dashboard content-column");
        this.numColumns = 2;

        this.columnStats = new Array();
        let thisDash = this;
        stats.forEach(function (stat, statIndex) {
            let columnIndex = (statIndex % thisDash.numColumns);
            while (thisDash.columnStats.length <= columnIndex) {
                thisDash.columnStats.push([]);
            }
            thisDash.columnStats[columnIndex].push(stat);
        });

        thisDash.columns = [];
        this.columnStats.forEach(function (stats){
            thisDash.columns.push(new StatColumn(thisDash.container, stats));
        });
    }

    updateForStats(stats) {
        let thisDash = this;
        stats.forEach(function (stat, statIndex){
            let columnIndex = (statIndex % thisDash.numColumns);
            let column = thisDash.columns[columnIndex];
            column.updateStat(stat);
        });
    }
}