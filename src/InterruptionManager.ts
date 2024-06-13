export class InterruptionManager {
    constructor() {
        this.shouldStop = false;
    }
    
    public stop(): void {
        this.shouldStop = true;
    }
    
    public check(): void {
        if (this.shouldStop) {
            let logStr: string = "Execution interrupted";
            console.log(logStr);
            throw new Error(logStr);
        }
    }

    public init(): void {
        this.shouldStop = false;
    }

    private shouldStop: boolean;
};