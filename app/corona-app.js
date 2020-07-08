import { json } from 'd3-fetch';
import { select } from 'd3-selection';

import Atlas from './src/Atlas.js'
import InfectionTimeSeries from './src/InfectionTimeSeries.js'
import VizController from './src/VizController.js'

const STATIC_ASSET_DOMAIN = "/";
const STATIC_ASSET_THUMBPRINT = "?d=LastUpdateToken";

var loadedCountyData = false;
var vizController = null;

function loadedData(countryGeometry, rawData, countryMobility) {

    console.time("Process top-level Data");

    let parentAtlas = new Atlas();

    let nationData = InfectionTimeSeries.fromJSONObject(rawData.nationData, parentAtlas);
    let coalitionData = null;
    let stateData = null;
    let countyData = null;

    parentAtlas.addAll(nationData.regionAtlas);
    nationData.updateForMobilityJSON(countryMobility);
    let USARegion = nationData.topRegion();

    if (rawData.coalitionData !== undefined) {
        coalitionData = InfectionTimeSeries.fromJSONObject(rawData.coalitionData, parentAtlas);
        parentAtlas.addAll(coalitionData.regionAtlas);
    }
    if (rawData.stateData !== undefined) {
        stateData = InfectionTimeSeries.fromJSONObject(rawData.stateData, parentAtlas);
        parentAtlas.addAll(stateData.regionAtlas);
    }

    console.timeEnd("Process top-level Data");

    console.log("Begin County CSV Load");
    console.time("Load County CSVs");
    Promise.all([json(STATIC_ASSET_DOMAIN + "processed-data/data-county.json" + STATIC_ASSET_THUMBPRINT),
        json(STATIC_ASSET_DOMAIN + "topo/counties-10m.json"),
        json(STATIC_ASSET_DOMAIN + "processed-data/mobility-coalition.json" + STATIC_ASSET_THUMBPRINT)
    ])
        .then(function(values) {

            console.timeEnd("Load County CSVs");
            let rawRemainingData = values[0];
            let remainingCountryGeometry = values[1];
            let coalitionMobilityJSON = values[2];

            console.time("Process remaining region data");

            coalitionData.updateForMobilityJSON(coalitionMobilityJSON);

            if (rawRemainingData.countyData !== undefined) {
                console.time("Parse county JSON");
                countyData = InfectionTimeSeries.fromJSONObject(rawRemainingData.countyData, parentAtlas);
                console.timeEnd("Parse county JSON");
            }
            console.timeEnd("Process remaining region data");

            if (remainingCountryGeometry !== undefined) {
                console.time("Create county paths");
                vizController.updateCountryGeometry(remainingCountryGeometry);
                console.timeEnd("Create county paths");
            }

            if (countyData !== null) {
                console.time("Update county fill");
                vizController.setCountyData(countyData);
                vizController.processURLPath(true, false, true);
                console.timeEnd("Update county fill");
            }

            console.timeEnd("Full Site Load");
        })

    loadStateMobilityData(stateData);

    console.log("Begin building initial view");
    console.time("Build initial view");
    vizController = new VizController(select( "body" ),
        countyData,
        stateData,
        nationData,
        coalitionData,
        USARegion,
        countryGeometry);
    vizController.didSelectCounty = function(currentCountyData) {
        if (!loadedCountyData) {
            loadedCountyData = true;
            loadCountyMobilityData(currentCountyData);
        }
    }
    console.timeEnd("Build initial view");
    console.timeEnd("First site load");
}

console.time("Full Site Load");
console.time("First site load");
console.time("Load top-level CSVs");
Promise.all([json(STATIC_ASSET_DOMAIN + "topo/states-10m.json"),
    json(STATIC_ASSET_DOMAIN + "processed-data/data-nation-state.json" + STATIC_ASSET_THUMBPRINT),
    json(STATIC_ASSET_DOMAIN + "processed-data/mobility-nation.json" + STATIC_ASSET_THUMBPRINT)])
    .then(function(values) {
        console.timeEnd("Load top-level CSVs");
        loadedData(values[0], values[1], values[2]);
    });

function loadStateMobilityData(currentStateData) {
    console.time("Load State mobility data");
    Promise.all([json(STATIC_ASSET_DOMAIN + "processed-data/mobility-state.json" + STATIC_ASSET_THUMBPRINT)])
        .then(function(values) {
            console.timeEnd("Load State mobility data");
            console.time("Process State mobility data");
            let stateMobilityJSON = values[0];
            currentStateData.updateForMobilityJSON(stateMobilityJSON);
            if (vizController.isStateSelected() || vizController.isCoalitionSelected()) {
                vizController.updateMobilityChart();
            }
            console.timeEnd("Process State mobility data");
        });
}

function loadCountyMobilityData(currentCountyData) {
    console.time("Load county mobility data");
    Promise.all([json(STATIC_ASSET_DOMAIN + "processed-data/mobility-county.json" + STATIC_ASSET_THUMBPRINT)])
        .then(function(values) {
            console.timeEnd("Load county mobility data");
            console.time("Process county mobility data");
            let countyMobilityJSON = values[0];
            currentCountyData.updateForMobilityJSON(countyMobilityJSON);
            vizController.updateMobilityChart();
            console.timeEnd("Process county mobility data");
        });
}
