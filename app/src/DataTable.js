import {RegionType} from "./Region";
import {normalizeDate, englishDateStringFromDate} from "./DateUtils";
import {event} from "d3-selection";

export default class DataTable {
    constructor(parentElementSelection, evaluators = [], sortEvaluator = null) {
        // View
        this.container = parentElementSelection.append("div").attr("class", "data-table-container content-column");
        this.table = this.container.append("div").attr("class", "data-table");
        this.tableHeader = this.table.append("div").attr("class", "data-table-header");
        this.tableHeaderRow = this.tableHeader.append("div").attr("class", "data-table-row");
        this.tableBody = this.table.append("div").attr("class", "data-table-body");
        this.attribution = this.table.append("div").attr("class", "data-attribution");
        this.numDataRows = this._defaultNumRows();

        // Sort
        this.descending = true;
        this.sortEvaluator = sortEvaluator;

        // Callback
        this.onRegionClicked = null;

        // Core
        this.data = null;
        this.dataIsIncomplete = true;
        this.highlightedRegionID = null;
        this.aggregateRegionID = null;
        this.updateForEvaluators(evaluators, sortEvaluator, false);
    }

    // aggregateSnapshot is expected as an InfectionSnapshot
    // data is expected as a map of (RegionID -> InfectionSnapshot)
    updateForData(aggregateSnapshot, data, animated, deferRender = false) {
        this.aggregateSnapshot = aggregateSnapshot;
        if (this.aggregateRegionID !== aggregateSnapshot.region.ID) {
            this.aggregateRegionID = aggregateSnapshot.region.ID;
            this.numDataRows = this._defaultNumRows();
        }

        this.data = data;
        this.highlightedRegionID = null;

        if (!deferRender) {
            this.render(animated);
        }
    }

    updateForEvaluators(evaluators, sortEvaluator, animated, deferRender = false) {
        this.evaluators = evaluators;
        this.sortEvaluator = sortEvaluator;

        if (this.sortEvaluator === null && evaluators.length > 0) {
            this.sortEvaluator = evaluators.first();
        }

        if (!deferRender) {
            this.render(animated);
        }
    }

    updateForSortEvaluator(evaluator, animated) {
        if (this.sortEvaluator !== null && this.sortEvaluator.equals(evaluator)) {
            this.descending = !this.descending;
        } else {
            this.sortEvaluator = evaluator;
            this.descending = true;
        }

        this.render(animated);
    }

    updateForHighlightedRegion(regionID) {
        this.highlightedRegionID = regionID;
        this.render(false);
    }

    render(animated) {
        if (this.data === null || this.evaluators.length === 0) {
            return;
        }

        let thisTable = this;

        this.tableHeaderRow.selectAll("div.data-table-cell").remove();
        this.tableHeaderRow.selectAll("div.data-table-cell")
            .data(this.evaluators, function(e) { return e.hashString(); })
            .join(function(enter) {
                return enter.append("div").attr("class", "data-table-cell")
                            .html(function (e, index) {
                                if (index === 0) {
                                    return thisTable._metadataSummaryHTML();
                                }
                                let result = e.title.replace(" ", "<br>");
                                return result;
                            })
                    .on("click", function (evaluator) {
                        thisTable._didClickEvaluator(evaluator);
                    });
            });

        let sortedData = Array.from(this.data.values());
        let sortFactor = this.descending ? 1.0 : -1.0;
        if (this.sortEvaluator !== null) {
            let sorter = this.sortEvaluator;
            sortedData.sort((snapshotA, snapshotB) => sortFactor * (sorter.valueForSnapshot(snapshotB)
                                                                            - sorter.valueForSnapshot(snapshotA)));
        }
        sortedData = sortedData.slice(0, this.numDataRows);

        sortedData.unshift(this.aggregateSnapshot);

        if (sortedData.length > 0 && this.highlightedRegionID === null) {
            this.highlightedRegionID = sortedData[0].region.ID;
        }

        let displayedRegionIDs = sortedData.map(snapshot => snapshot.region.ID);
        let highlightedRegionOutOfTopN = false;
        if (!displayedRegionIDs.includes(this.highlightedRegionID)) {
            let highlightedData = (this.highlightedRegionID === this.aggregateSnapshot.region.ID) ? this.aggregateSnapshot
                                                                                                  : this.data.get(this.highlightedRegionID);
            if (highlightedData === undefined) {
                debugger;
            }
            sortedData.push(highlightedData);
            highlightedRegionOutOfTopN = true;
        }

        let evals = this.evaluators;
        this.tableBody.selectAll("div.data-table-row")
            .data(sortedData, function(snapshot, index) {
                return thisTable._d3KeyForSnapshot(snapshot, index, highlightedRegionOutOfTopN);
            })
            .join(function (enter) {
                    let result = enter.append("div")
                        .attr("class", function (snapshot, index) {
                            this.__key = thisTable._d3KeyForSnapshot(snapshot, index, highlightedRegionOutOfTopN);
                            return thisTable._classNameForRowWithSnapshot(snapshot, highlightedRegionOutOfTopN);
                        })
                        .on("click", function (snapshot) {
                            thisTable._didClickRegion(snapshot.region);
                            event.preventDefault();
                        })
                        .on("touchstart", function (snapshot) {
                            // Adding this listener enables :active state
                            thisTable._touchDidMove = false;
                        })
                        .on("touchmove", function (snapshot) {
                            thisTable._touchDidMove = true;
                        })
                        .on("touchend", function (snapshot){
                            if (!thisTable._touchDidMove) {
                                thisTable._didClickRegion(snapshot.region);
                                event.preventDefault();
                            }
                        });
                    evals.forEach(function (e, index) {
                       result = result.append("div").attr("class", "data-table-cell")
                                      .html(function (snapshot) {
                                          return e.formatValueHTML(snapshot, e.valueForSnapshot(snapshot));
                                      })
                                      .select(function() { return this.parentNode; });
                    });
                    return result;
                },
                function (update) {
                    let result = update.filter(function(snapshot, index) {
                        let newKey = thisTable._d3KeyForSnapshot(snapshot, index, highlightedRegionOutOfTopN);
                        if (newKey !== this.__key) {
                            this.__key = newKey;
                            return true;
                        }
                        return false;
                    });
                    result = result.attr("class", function (snapshot) {
                        return thisTable._classNameForRowWithSnapshot(snapshot, highlightedRegionOutOfTopN);
                    });
                    result = result.selectAll("div.data-table-cell")
                        .html(function (snapshot, index) {
                            let e = evals[index];
                            return e.formatValueHTML(snapshot, e.valueForSnapshot(snapshot));
                        });
                    result = result.select(function () {return this.parentNode;});
                    return result;
                },
                function (exit) {
                    return exit.remove();
                }
            );


        if (this.showButton !== undefined) {
            this.showButton.remove();
        }

        if (this._needsShowButton()) {
            let showButtonText = this._isTruncatingTable() ? "Show more" : "Show less";
            this.showButton = this.tableBody.append("div")
                .attr("class", "data-table-button-row")
                .on("click", function (){
                    thisTable._didClickShowButton();
                })
                .on("touchstart", function (snapshot) {
                    // Adding this listener enables :active state
                });
            this.showButton.append("div")
                .attr("class", "data-table-button-cell")
                .text(showButtonText);
        }

        this.attribution.text(this._sourceString());
    }

    aggregateRegionType() {
        if (this.aggregateSnapshot === null || this.aggregateSnapshot === undefined) {
            return RegionType.Nation;
        }

        return this.aggregateSnapshot.region.type;
    }

    childRegionType() {
        return this.aggregateRegionType() + 1;
    }

    _d3KeyForSnapshot(snapshot, index, isPastTruncationPoint) {
        return snapshot.dateString
            + "*" + index
            + "*" + snapshot.region.ID
            + this.sortEvaluator.title
            + this._classNameForRowWithSnapshot(snapshot, isPastTruncationPoint);
    }

    _classNameForRowWithSnapshot(snapshot, isPastTruncationPoint = false) {
        let className = "data-table-row";
        if (snapshot.region.ID === this.highlightedRegionID) {
            className += " highlighted";
            if (isPastTruncationPoint) {
                className += " data-table-row-after-truncation";
            }
        }
        return className;
    }

    _metadataSummaryHTML() {
        let date = this.aggregateSnapshot.normalizedDate();
        let dateString = englishDateStringFromDate(date);
        let result = dateString;
        if (this.dataIsIncomplete) {
            result += "<br /><i>Updated hourly</i>";
        }
        return result;
    }

    _sourceString() {
        let sourceString = this.sortEvaluator.source;
        return "Data from " + sourceString;
    }

    _defaultNumRows() {
        return 5;
    }

    _needsShowButton() {
        return this.data.size > this._defaultNumRows();
    }

    _isTruncatingTable() {
        return (this.numDataRows < this.data.size) && (this.data.size > this._defaultNumRows());
    }

    // Callbacks

    _didClickEvaluator(evaluator) {
        this.updateForSortEvaluator(evaluator, false);
    }

    _didClickRegion(region) {
        if (this.onRegionClicked !== null) {
            this.onRegionClicked(region.ID);
        }
    }

    _didClickShowButton() {
        if (this._isTruncatingTable()) {
            this.numDataRows += this._defaultNumRows();
        } else {
            this.numDataRows = this._defaultNumRows();
        }

        this.render(false);
    }
}