import {select, selection} from 'd3-selection';
import {interpolateNumber} from 'd3-interpolate';

//Moves selection to front
selection.prototype.moveToFront = function() {
    return this.each(function(){
        this.parentNode.appendChild(this);
    });
};

//Moves selection to back
selection.prototype.moveToBack = function() {
    return this.each(function() {
        let firstChild = this.parentNode.firstChild;
        if (firstChild) {
            this.parentNode.insertBefore(this, firstChild);
        }
    });
};

selection.prototype.first = function() {
    return select(this._groups[0][0]);
};

selection.prototype.last = function() {
    let last = this.size() - 1;
    return select(this._groups[0][last]);
};
