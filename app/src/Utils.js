import {normalizeDate, MS_IN_HOUR, MS_IN_DAY} from "./DateUtils";

export function HashString(s) {
	var h = 0, l = s.length, i = 0;
	if ( l > 0 )
		while (i < l)
			h = (h << 5) - h + s.charCodeAt(i++) | 0;
	return "hash" + h.toString();
}

String.prototype.capitalize = function() {
	return this.charAt(0).toUpperCase() + this.slice(1)
}

Date.prototype.addHours = function(h) {
	return normalizeDate(new Date(this.getTime() + (h*MS_IN_HOUR)));
}

Date.prototype.addDays = function(d) {
	return normalizeDate(new Date(this.getTime() + (d*MS_IN_DAY)));
}

Array.prototype.last = function(){
	return this[this.length - 1];
};

Array.prototype.first = function(){
	return this[0];
};