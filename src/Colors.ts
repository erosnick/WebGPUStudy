export class Colors {
    static toRGB(r: number, g: number, b: number) {
        return [r / 255.0, g / 255.0, b / 255.0]
    }

    static random() {
        return [Math.random(), Math.random(), Math.random()]
    }
}
