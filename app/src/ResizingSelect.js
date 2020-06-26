export default class ResizingSelect {
    constructor(parentElementSelection, standalone = false) {
        this.standalone = standalone;
        let standaloneClass = standalone ? " standalone" : "";
        let thisElement = this;
        this.parent = parentElementSelection;
        this.form = parentElementSelection.append("form")
            .attr("id","resizingForm")
            .attr("class", "region-select-text" + standaloneClass);
        this.select = this.form.append("select")
            .attr("id", "resizingSelect")
            .attr("class", "title")
            .on("change", function() {
                thisElement._didChange(this);
            });
        this.onRegionSelected = null;
        this.selectedRegionID = null;
    }

    elementSelection() {
        return this.form;
    }

    _resize(selectElement) {
        let selectedOption = selectElement.options[selectElement.selectedIndex];
        if (selectedOption !== undefined) {
            // Create a temporary select with only one option for dynamic sizing
            let sizingSelect = this.form.append("select").attr("class", "title sizing-only");
            let sizingOption = sizingSelect.append("option").text(selectedOption.text);
            let snugWidth = sizingSelect.style("width");
            sizingSelect.remove();

            // Resize according to the temporary select width
            this.select.style("width", snugWidth);
        }
    }

    _didChange(selectElement) {
        this._resize(selectElement);
        let selectedOption = selectElement.options[selectElement.selectedIndex];
        if (selectedOption !== undefined && this.onRegionSelected !== null) {
            this.selectedRegionID = selectedOption.value;
            this.onRegionSelected(this.selectedRegionID);
        }
    }

    _currentlySelectedIndex() {
        return this.select.node().selectedIndex;
    }

    setSelectedRegionWithID(regionID) {
        let relevantOption = this.select.select("option[value='" + regionID +"']").node();
        let newIndex = relevantOption.index;
        let currentIndex = this._currentlySelectedIndex();
        if (newIndex != currentIndex) {
            this.select.node().selectedIndex = relevantOption.index;
            this._didChange(this.select.node());
        }
    }

    updateForOptions(options) {
        this.options = options;

        // Out with the old
        this.select.selectAll("optgroup").remove();

        // In with the new
        let thisElement = this;
        this.options.forEach(function (groupOptions, groupName){
            let thisGroup = thisElement.select.append("optgroup").attr("label", groupName);
            groupOptions.forEach(function (region) {
                thisGroup.append("option")
                    .attr("value", region.ID)
                    .text(thisElement.standalone ? region.fullyQualifiedName() : region.qualifiedNameWithArticle());
            });
        });

        this._resize(this.select.node());
    }
}