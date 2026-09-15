export class Queue {
    constructor() {
        this.tracks = [];
    }

    add(track) {
        this.tracks.push(track);
    }

    prepend(track) {
        this.tracks.unshift(track);
    }

    remove(index) {
        return this.tracks.splice(index, 1)[0];
    }

    clear() {
        this.tracks = [];
    }

    get size() {
        return this.tracks.length;
    }

    get all() {
        return [...this.tracks];
    }

    get next() {
        return this.tracks.shift();
    }

    peek(index = 0) {
        return this.tracks[index];
    }
}
