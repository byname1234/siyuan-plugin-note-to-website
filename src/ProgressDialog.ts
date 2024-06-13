import { Dialog } from "siyuan";
import NoteToWebsitePlugin from "./index";

export class ProgressDialog extends Dialog {
    constructor(plugin: NoteToWebsitePlugin) {
        let options = {
            title: `NoteToWebsite`,
            content: `
            <style>
              @keyframes breathing {
                0%, 100% {
                  opacity: 1; /* 开始和结束时完全显示 */
                }
                50% {
                  opacity: 0.5; /* 在中间阶段透明度减半 */
                }
              }
              progress {
                width: 80%; /* 根据需要调整进度条的宽度 */
                height: 20px; /* 根据需要调整进度条的高度 */
                /* 应用动画，动画名称为 breathing，持续时间 2s，无限循环 */
                animation: breathing 2s ease-in-out infinite;
              }
            </style>

            <div class="b3-dialog__body">
              <div class="b3-dialog__content">

                <div class="fn__flex b3-label">
                  <output id="progresshint"></output>
                </div>

                <div class="fn__flex b3-label">
                  <progress style="width:100%" value="100" max="100" id="progress"></progress>
                  <div class="fn__space"></div>
                  <div class="fn__space"></div>
                  <output style="width:6%;white-space:nowrap;" id="progressprecent">100%</output>
                </div>

                <div class="b3-dialog__action">
                  <button class="b3-button b3-button--cancel" id="cancelbtn">cancel</button>
                </div>

              </div>
            </div>
            `,
            width: plugin.isMobile? "92vw" : "720px",
            destroyCallback(options) {},
            disableClose: true,
            disableAnimation: true,
        };

        super(options);
        this.plugin = plugin;
    }

    public init(): void {
        // 目前不知道总共的执行步数, 设为-1时会按每步增加微量的进度值来处理进度;
        this.progressTotalStepCnt = -1;
        this.progressPastStepCnt = 0;
        this.progressElement = this.element.querySelector("#progress") as HTMLInputElement;
        this.progressHintElement = this.element.querySelector("#progresshint") as HTMLOutputElement;
        this.progressPrecentElement = this.element.querySelector("#progressprecent") as HTMLOutputElement;
        this.cancelBtn = this.element.querySelector("#cancelbtn") as HTMLButtonElement;
        this.progressElement.value = "0";
        this.progressElement.max = "100";
        this.progressPrecentElement.value = "0%";
        this.setCancelBtnText("放弃");
        this.cancelBtn.addEventListener("click", () => this.onCancelBtnClicked());
    }

    public setCancelBtnText(text: string): void {
        this.cancelBtn.innerText = text;
    }

    public setHint(content: string, color: string = ""): void {
        this.progressHintElement.style.color = color;
        this.progressHintElement.value = content;
    }

    public setHtmlHint(content: string, color: string = ""): void {
        this.progressHintElement.style.color = color;
        this.progressHintElement.innerHTML = content; 
    }

    public setProgressTotalStepCnt(cnt: number): void {
        this.progressTotalStepCnt = cnt;
    }

    public setProgressPastStepCnt(cnt: number): void {
        this.progressPastStepCnt = cnt;
    }

    public setProgressMax(max: string): void {
        this.progressElement.max = max; 
    }

    public setProgressVal(val: string): void {
        this.progressElement.value = val; 
    }

    public setProgressPrecent(val: string): void {
        this.progressPrecentElement.value = val;
    }

    public getProgressMax(): string {
        return this.progressElement.max;
    }

    public getProgressVal(): string {
        return this.progressElement.value;
    }

    public getProgressPrecent(): string {
        return this.progressPrecentElement.value;
    }

    public showMsg(content: string): void {
        this.plugin.checkInterrupt();
        this.setHint(content);
    }

    public showErrMsg(content: string): void {
        this.plugin.checkInterrupt();
        this.setHint(content, "red");
    }

    public showHtmlErrMsg(content: string): void {
        this.plugin.checkInterrupt();
        this.setHtmlHint(content, "red");
    }

    public setProgress(val: number): void {
        this.plugin.checkInterrupt();
        let max: number = Number(this.progressElement.max);
        this.progressElement.value = val.toString();
        this.progressPrecentElement.value = ((val/max)*100).toFixed(2) + "%";
    }

    private increaseProgress(add: number): void {
        this.plugin.checkInterrupt();
        let val: number = Number(this.getProgressVal());
        let max: number = Number(this.getProgressMax());
        val += add;
        this.setProgressVal(val.toString());

        // 四舍五入只保留整数部分
        // this.progressDialog.setProgressPrecent(Math.round((val/max)*100) + "%");

        // 保留小数点后两位
        this.setProgressPrecent(((val/max)*100).toFixed(2) + "%");
    }

    public updateProgress(msg: string = "", addTotalStepCnt: number = 1): void {
        this.plugin.checkInterrupt();
        if (this.progressTotalStepCnt === -1) {
            this.increaseProgress(0.01);
        } else {
            this.progressTotalStepCnt += addTotalStepCnt;
            let lastProgressUnitCnt: number 
                = Number(this.progressElement.max) - Number(this.progressElement.value);
            let lastProgressStepCnt: number = this.progressTotalStepCnt - this.progressPastStepCnt;
            if (lastProgressStepCnt > 0) {
                let increaseVal: number = Number((lastProgressUnitCnt/lastProgressStepCnt).toFixed(20));
                this.increaseProgress(increaseVal);
                this.progressPastStepCnt += 1;
            }
        }
        if (!(msg === undefined || msg === null || msg === "")) {
            this.showMsg(msg);
        }
    }

    private onCancelBtnClicked(): void {
        this.plugin.stopAll();
        this.destroy();
    }

    public startFakeUpdateProgress(intervalMs: number = 70): void {
        // 保证用户看到的进度条永远在前进
        this.fakeUpdateIntervalId = setInterval(() => {
            this.updateProgress();
        }, intervalMs);
    }

    public stopFakeUpdateProgress(): void {
        clearInterval(this.fakeUpdateIntervalId);
    }

    private plugin: NoteToWebsitePlugin;
    private progressTotalStepCnt: number;
    private progressPastStepCnt: number;
    private progressElement: HTMLInputElement;
    private progressHintElement: HTMLOutputElement;
    private progressPrecentElement: HTMLOutputElement;
    private cancelBtn: HTMLButtonElement;
    private fakeUpdateIntervalId: NodeJS.Timeout;
};