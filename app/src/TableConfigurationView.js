import EvaluatorLibrary from "./EvaluatorLibrary";

export const BaseStatistic  = {
    ConfirmedCases: 0,
    Deaths: 1,
    Hospitalizations: 2,
    TestsPerformed: 3,
    PercentPositive: 4,
};

export default class TableConfigurationView {
    constructor(parentElementSelection, dateRange = null) {
        this.baseStat = -1;
        this.dateRange = dateRange;
        this.recentDateRange = [dateRange[1].addDays(-60), dateRange[1]];

        this.didUpdateEvaluators = null;

        let thisConfig = this;
        this.baseStatToggle = parentElementSelection.append("div")
            .attr("class", "layer-toggles content-column");
        this.caseButton = this.baseStatToggle.append("button")
            .attr("class", "toggle-button")
            .text("Cases")
            .on("click", function() { thisConfig._didClickStatButton(this)});
        this.deathButton = this.baseStatToggle.append("button")
            .attr("class", "toggle-button")
            .text("Deaths")
            .on("click", function() { thisConfig._didClickStatButton(this)});
        this.hospitalizationButton = this.baseStatToggle.append("button")
            .attr("class", "toggle-button")
            .text("Hospitalizations")
            .on("click", function() { thisConfig._didClickStatButton(this)});
        // this.testButton = this.baseStatToggle.append("button")
        //     .attr("class", "toggle-button")
        //     .text("Tests")
        //     .on("click", function() { thisConfig._didClickStatButton(this)});
        this.percentPositiveButton = this.baseStatToggle.append("button")
            .attr("class", "toggle-button")
            .text("% Positive")
            .on("click", function() { thisConfig._didClickStatButton(this)});

        this._setBaseStat(BaseStatistic.ConfirmedCases);
    }

    currentEvaluators() {
        return TableConfigurationView.evaluatorsForConfiguration(this);
    }

    sortEvaluator() {
        let currentEvals = this.currentEvaluators();
        if (currentEvals.length > 1) {
            return currentEvals[1];
        }

        return null;
    }

    _didClickStatButton(button) {
        let newStat = this._baseStatForButton(button);
        this._setBaseStat(newStat);
    }

    static activeClassName() {
        return "active";
    }

    _setBaseStat(baseStatistic) {
        if (this.baseStat === baseStatistic) {
            return;
        }

        this.baseStat = baseStatistic;

        const activeClass = TableConfigurationView.activeClassName();
        this.baseStatToggle.selectAll("button").each(function() {
            this.classList.remove(activeClass);
        });
        let newlySelectedButton = this._buttonForBaseStat(baseStatistic);
        newlySelectedButton.classList.add(activeClass);

        this._didUpdate();
    }

    _didUpdate() {
        if (this.didUpdateEvaluators) {
            this.didUpdateEvaluators(this.currentEvaluators());
        }
    }

    _baseStatForButton(buttonNode) {
        if (buttonNode === this.caseButton.node()) {
            return BaseStatistic.ConfirmedCases;
        } else if (buttonNode === this.deathButton.node()) {
            return BaseStatistic.Deaths;
        } else if (buttonNode === this.hospitalizationButton.node()) {
            return BaseStatistic.Hospitalizations;
        } else if (buttonNode === this.percentPositiveButton.node()) {
            return BaseStatistic.PercentPositive;
        } else if (buttonNode === this.testButton.node()) {
            return BaseStatistic.TestsPerformed;
        }

        return undefined;
    }

    _buttonForBaseStat(baseStat) {
        if (baseStat === BaseStatistic.ConfirmedCases) {
            return this.caseButton.node();
        } else if (baseStat === BaseStatistic.Deaths) {
            return this.deathButton.node();
        }  else if (baseStat === BaseStatistic.Hospitalizations) {
            return this.hospitalizationButton.node();
        } else if (baseStat === BaseStatistic.PercentPositive) {
            return this.percentPositiveButton.node();
        } else if (baseStat === BaseStatistic.TestsPerformed) {
            return this.testButton.node();
        }

        return undefined;
    }

    static evaluatorsForConfiguration(configurationView) {
        let metricEvaluators = [];
        if (configurationView.baseStat === BaseStatistic.ConfirmedCases) {
            metricEvaluators = [EvaluatorLibrary.newConfirmedCaseEvaluator(),
                                EvaluatorLibrary.newCaseTrendEvaluator(),
                                EvaluatorLibrary.newCaseGraphicEvaluator(configurationView.recentDateRange)];
        } else if (configurationView.baseStat === BaseStatistic.Deaths) {
            metricEvaluators = [EvaluatorLibrary.newDeathEvaluator(),
                                EvaluatorLibrary.newDeathTrendEvaluator(),
                                EvaluatorLibrary.newDeathGraphicEvaluator(configurationView.recentDateRange)];
        } else if (configurationView.baseStat === BaseStatistic.TestsPerformed) {
            metricEvaluators = [EvaluatorLibrary.newTestEvaluator(),
                                EvaluatorLibrary.newTestTrendEvaluator(),
                                EvaluatorLibrary.newTestGraphicEvaluator(configurationView.recentDateRange)];
        } else if (configurationView.baseStat === BaseStatistic.Hospitalizations) {
            metricEvaluators = [EvaluatorLibrary.currentlyHospitalizedEvaluator(),
                                EvaluatorLibrary.currentlyHospitalizedTrendEvaluator(),
                                EvaluatorLibrary.currentlyHospitalizedGraphicEvaluator(configurationView.recentDateRange)];
        } else if (configurationView.baseStat === BaseStatistic.PercentPositive) {
            metricEvaluators = [EvaluatorLibrary.newTestPercentPositiveEvaluator(true),
                                EvaluatorLibrary.dailyPercentPositiveTrendEvaluator(),
                                EvaluatorLibrary.dailyPercentPositiveGraphicEvaluator(configurationView.recentDateRange)];
        }

        return [EvaluatorLibrary.regionNameEvaluator()].concat(metricEvaluators);
    }
}