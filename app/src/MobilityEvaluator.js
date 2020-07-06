import { format } from 'd3-format';

import { DEATH_DATA_COLOR } from './Evaluator.js'
import Evaluator from './Evaluator.js';
import EvaluatorLibrary from './EvaluatorLibrary.js';
import { MobilityType } from "./MobilityData.js";
import { RegionType } from './Region.js';

export const MOBILITY_DATA_COLOR = "131,182,146";
export const MOBILITY_DARK_COLOR = "49,84,71";
const GOOGLE_MOBILITY_NAME = "Google Mobility";

export default class MobilityEvaluator {

    static MobilityTypeForToggleCount(toggleCount) {
        return (toggleCount % MobilityType.NumTypes);
    }

    static MobilityStatFromSnapshot(evaluator, snapshot) {
        if (snapshot.mobilityData === null) {
            return null;
        }

        switch (MobilityEvaluator.MobilityTypeForToggleCount(evaluator.toggleCount)) {
            case MobilityType.RetailAndRecreation:
                return snapshot.mobilityData.retailAndRecreation;
            case MobilityType.Residential:
                return snapshot.mobilityData.residential;
            case MobilityType.Workplace:
                return snapshot.mobilityData.workplace;
            case MobilityType.Parks:
                return snapshot.mobilityData.parks;
            case MobilityType.Transit:
                return snapshot.mobilityData.transit;
        }

        return null;
    }

    static MobilityAdjectiveForEvaluator(evaluator) {
        switch (MobilityEvaluator.MobilityTypeForToggleCount(evaluator.toggleCount)) {
            case MobilityType.RetailAndRecreation:
                return "Retail";
            case MobilityType.Residential:
                return "Residential";
            case MobilityType.Workplace:
                return "Workplace";
            case MobilityType.Parks:
                return "Park";
            case MobilityType.Transit:
                return "Transit";
        }

        return null;
    }

     static NounForEvaluator(evaluator) {
        let type = MobilityEvaluator.MobilityAdjectiveForEvaluator(evaluator);
        return type.toLowerCase() + " visits";
     }

     static DescriptionTemplateForEvaluator(evaluator) {
         let headlineSentence = "<Token:FullyQualifiedNoun> <Token:RegionPreposition> <Token:Region> are <Token:DataQuantityDirection> <Token:DataQuantity> <Token:TimePreposition> <Token:ShortDate>.";
         let categoryDescriptionSentence = MobilityEvaluator.CategoryDescriptionForEvaluator(evaluator);
         let changeSentence = " On average, visits <Token:ChangeVerbWeekProgressive>: this metric has <Token:ChangeVerbWeek> <Token:AmountChangeWeek> when compared to a week ago, and <Token:ChangeVerbMonth> <Token:AmountChangeMonth> when compared to a month ago.";
         return headlineSentence + categoryDescriptionSentence + changeSentence;
     }

     static CategoryDescriptionForEvaluator(evaluator) {
        switch (MobilityEvaluator.MobilityTypeForToggleCount(evaluator.toggleCount)) {
            case MobilityType.RetailAndRecreation: {
                return " This metric includes places like restaurants, shopping centers, theme parks, and movie theaters."
                break;
            }
            case MobilityType.Transit: {
                return " This metric includes places like public transit hubs, such as subway, bus, and train stations.";
                break;
            }
            case MobilityType.Parks: {
                return " This metric includes places like national parks, public beaches, plazas, and public gardens.";
                break;
            }
        }

        return "";
     }

    static mobilityDataEvaluator(needsBenchmark = true) {
        let result = EvaluatorLibrary.baseLogHeatMapEvaluator("Mobility", "cases");

        result.setBaseStat(function (evaluator, snapshot) {
            return MobilityEvaluator.MobilityStatFromSnapshot(evaluator, snapshot);
        });
        result.statDescriptionFunction = function (evaluator) {
            return MobilityEvaluator.MobilityAdjectiveForEvaluator(evaluator);
        };
        result.toggleFunction = function(evaluator) { // Just return a simple copy, everything happens via toggleCount
            let result = Evaluator.from(evaluator);
            result.descriptionTemplate = MobilityEvaluator.DescriptionTemplateForEvaluator(evaluator);
            return result;
        };

        result.allowNegative = true;
        result.displayAsPercent = true;
        result.valueFormatter = format(".0%");
        result.nounWithNumber = "change";
        result.noun = "visitation";
        result.anchorNoun = "mobility";
        result.baseRGB = MOBILITY_DATA_COLOR;
        result.supportedRegionLevel = RegionType.County;
        result.maxPowerOfTen = 0.0;
        result.descriptionTemplate = MobilityEvaluator.DescriptionTemplateForEvaluator(result);
        result.nounQualifier = function (evaluator) { return MobilityEvaluator.NounForEvaluator(evaluator); };
        result.source = GOOGLE_MOBILITY_NAME;
        if (needsBenchmark) {
            result.benchmarkEvaluator = MobilityEvaluator.nationalMobilityDataEvaluator();
            result.benchmarkRegionType = RegionType.Nation;
        }

        return result;
    }

    static nationalMobilityDataEvaluator() {
        let result = MobilityEvaluator.mobilityDataEvaluator(false);
        result.title = "National Mobility Data";
        result.baseRGB = MOBILITY_DARK_COLOR;
        result.smoothed = true;
        result.wantsFill = false;
        result.annotation = "<tspan x='0'>National</tspan><tspan x='0'dy='14'>average</tspan>"
        return result;
    }
}