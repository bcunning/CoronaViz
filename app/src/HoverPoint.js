export default class HoverPoint {
    constructor(dataIndex, data) {
        this.dataIndex = dataIndex;
        this.data = data;
    }

    equals(otherHoverPoint) {
        if (otherHoverPoint === null) {
            return false;
        }

        return (this.dataIndex === otherHoverPoint.dataIndex);
    }
}