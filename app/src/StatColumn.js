export default class StatColumn {
    constructor(parentElementSelection, stats) {
        this.stats = stats;
        this.container = parentElementSelection.append("div").attr("class", "stat-column");

        this.labelDivs = new Map();
        this.valueDivs = new Map();
        let thisColumn = this;
        stats.forEach(function(stat){
            thisColumn.valueDivs.set(stat.label, thisColumn.container.append("div").attr("class", "stat-value").text(stat.value));
            thisColumn.labelDivs.set(stat.label, thisColumn.container.append("div").attr("class", "stat-label").text(stat.label));
        });
    }

    updateStat(newStat) {
        let valueDiv = this.valueDivs.get(newStat.label);
        valueDiv.text(newStat.value);
    }
}