const { exec } = require("child_process");
const { EventEmitter } = require("events");

export class CommandExecutor extends EventEmitter {
    execute(command: string): void {
        this.childProcess = exec(command);
        this.childProcess.stdout?.on("data", (data) => {
            this.emit("output", data.toString());
        });
        this.childProcess.stderr?.on("data", (data) => {
            this.emit("error", data.toString());
        });
        this.childProcess.on("exit", (code) => {
            this.emit("exit", code);
        });
    }

    public kill(): void {
        this.childProcess.kill();
    }

    private childProcess: any;
};