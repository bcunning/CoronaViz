export default class ScaleParameters {
    constructor(yMin, yMax, useOvershoot) {
        this.yMin = yMin;
        this.yMax = yMax;
        this.yDataMin = yMin;
        this.yDataMax = yMax;
        this.useOvershoot = useOvershoot;
    }
}