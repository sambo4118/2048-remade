const canvas = document.getElementById("game");
const context = canvas.getContext("2d");

class Grid {
    constructor(size = 4) {
        this.size = size;
        this.cells = this.createEmptyGrid();
    }

    createEmptyGrid() {
        return Array.from({ length: this.size }, () => Array(this.size).fill(0));
    }
}