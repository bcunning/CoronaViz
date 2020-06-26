export default class CGRect {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    unionRect(otherRect) {
        let newLeft = Math.min(this.x, otherRect.x);
        let newTop = Math.min(this.y, otherRect.y);
        let newRight = Math.max(this.x + this.width, otherRect.x + otherRect.width);
        let newBottom = Math.max(this.y + this.height, otherRect.y + otherRect.height);

        this.x = newLeft;
        this.y = newTop;
        this.width = newRight - newLeft;
        this.height = newBottom - newTop;
    }

    aspectRatio() {
        return this.width / this.height;
    }

    left() {
        return this.x;
    }

    right() {
        return this.x + this.width;
    }

    top() {
        return this.y;
    }

    bottom() {
        return this.y + this.height;
    }

    toString() {
        return "(x:" + this.x + " y:" + this.y + " w:" + this.width + " h:" + this.height + ")";
    }

    static fromSVGRect(otherRect) {
        return new CGRect(otherRect.x, otherRect.y, otherRect.width, otherRect.height);
    }
}