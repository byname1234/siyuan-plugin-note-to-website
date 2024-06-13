import { CommandExecutor } from "./CommandExecutor";
import { deleteDirectorySync } from "./MyTools";
import { MkdocsAsyncBuilder } from "./MkdocsAsyncBuilder";
import NoteToWebsitePlugin, { STORAGE_2 } from "./index";
const { execSync } = require("child_process");

const fs = require("fs");
const url = require("url");
const path = require("path");
const https = require("https");

export class EnvAsyncProcessor {
    constructor() {
        this.mkdocsAsyncBuilder = new MkdocsAsyncBuilder(); 
    }

    public init(plugin: NoteToWebsitePlugin): boolean {
        if (plugin === undefined || plugin === null) {
            return false;
        }
        this.plugin = plugin;
        this.mkdocsAsyncBuilder.init(plugin);
        return true;
    }

    private getVenvPythonVersion(venvPath: string): string {
        const cfgPath = path.join(venvPath, "pyvenv.cfg");
        try {
            let cfgContent: any = fs.readFileSync(cfgPath, "utf8");
            let match: any = cfgContent.match(/version\s*=\s*(.+)/);
            if (match && match[1]) {
                return match[1].trim();
            }
        } catch (error) {
            console.warn(`无法读取 ${cfgPath}: ${error.message}`);
        }
        return null;
    }

    private isPythonVenvValid(): boolean {
        this.plugin.checkInterrupt();
        let path: string = this.plugin.absolutePythonVenvDir;
        if (path === undefined || path === null || path === "") {
            return false;
        }
        let ver: string = this.getVenvPythonVersion(path);
        if (ver === null) {
            // 无法从虚拟环境的配置文件中读出版本信息, 说明此虚拟环境目录不存在或者已损坏;
            return false;
        }
        if (ver !== this.plugin.trueEnvPythonVersion) {
            // 虚拟环境的Python版本与真实环境不一致, 说明真实环境可能重装了其他版本的Python;
            return false;
        }
        return true;
    }

    private checkPython(): string {
        this.plugin.checkInterrupt();
        let ver: string = "";
        // Python2.7会将版本信息输出到标准错误流, 为方便处理, 这里统一将标准错误流重定向到标准输出;
        let cmd: string = "python --version 2>&1";
        try {
            let ret: Buffer = execSync(cmd);
            ver = ret.toString().trim();
            ver = ver.replace("Python", "").trim();
            console.log("Python is installed, version: " + ver);
        } catch (err) {
            console.error("Python is not installed !");
        }
        return ver;
    }

    /**
     * 将版本号字符串转换为数字
     * 
     * @param {string} ver - 版本号字符串 
     * @returns {number[]} 版本号数组
     * @example
     * 不论输入的的是几位版本号, 最终都会转换为三位形式:
     * 3.7.x -> 3,7,0
     * 3.7 -> 3,7,0
     * 3.7.5rc1 -> 3,7,5
     * 3.7.5dev -> 3,7,5
     * 3.7rc1 -> 3,7,0
     */
    private versionStrToNum(ver: string): number[] {
        if (ver === undefined || ver === null || ver === "") {
            return [];
        }

        let mainVer: string = "";

        // 提取主版本号, 例如: 3.7.5rc1 -> 3.7.5;
        for (let c of ver) {
            if (!(c === "." || !isNaN(Number(c)))) {
                break;
            }
            mainVer += c;
        }
        if (mainVer.endsWith(".")) {
            mainVer = mainVer.slice(0, -1);
        }

        let verSplit: string[] = mainVer.split(".").splice(0, 3);
        let verSplitNum: number[] = [];
        for (let v of verSplit) {
            let n = Number(v);
            if (isNaN(n)) {
                verSplitNum.push(0);
            } else {
                verSplitNum.push(n);
            }
        }
        for (let i = 0; i < 3-verSplitNum.length; i++) {
            verSplitNum.push(0);
        }
        return verSplitNum;
    }

    /**
     * 比较版本号大小
     * 
     * @param {string} ver1 - 版本号字符串1
     * @param {string} ver2 - 版本号字符串2
     * @returns {number}
     *  ver1 > ver2 : return 1;
     *  ver1 === ver2 : return 0;
     *  ver1 < ver2 : return -1;
     *  error: return -2;
     */
    private compareVersion(ver1: string, ver2: string): number {
        if (ver1 === undefined || ver1 === null || ver1 === "") {
            return -2;
        }
        if (ver2 === undefined || ver2 === null || ver2 === "") {
            return -2; 
        }

        console.log("ver1: " + ver1);
        console.log("ver2: " + ver2);

        let splitVerNum1: number[] = this.versionStrToNum(ver1);
        let splitVerNum2: number[] = this.versionStrToNum(ver2);

        console.log("split ver1: " + splitVerNum1);
        console.log("split ver2: " + splitVerNum2);

        for (let i = 0; i < splitVerNum1.length; i++) {
            let n1 = splitVerNum1[i];
            let n2 = splitVerNum2[i];
            if (n1 === n2) {
                continue;
            }
            if (n1 > n2) {
                return 1;
            }
            if (n1 < n2) {
                return -1;
            }
        }
        return 0;
    }

    private checkVersionSufficient(ver: string, needVer: string): boolean {
        if (ver === undefined || ver === null || ver === "") {
            return false;
        }
        if (needVer === undefined || needVer === null || needVer === "") {
            return false;
        }
        let ret: number = this.compareVersion(ver, needVer);
        if (ret >= 0) {
            return true;
        }
        return false;
    } 

    private createPythonVenvAsync(): void {
        this.plugin.checkInterrupt();
        let commandExecutor: CommandExecutor = new CommandExecutor();
        this.plugin.cmdExecutors.push(commandExecutor);
        commandExecutor.on("output", (output: string) => {
            this.plugin.checkInterrupt();
            console.log(output);
        });
        commandExecutor.on("exit", (code: number) => {
            if (code === 0) {
                this.onCreatePythonVenvSuccess();
            } else if (code > 0) {
                this.onCreatePythonVenvFailed(code);
            } else if (code === null) {
            }
        });
        commandExecutor.on("error", (error: string) => {
            this.plugin.stopFakeUpdateProgress();
            console.error(error);
            this.plugin.absolutePythonVenvDir = "";
        });

        // 只是尽力删除, 此次删除失败也无妨, 例如目录下有文件被占用的情况;
        deleteDirectorySync(this.plugin.absolutePythonVenvRootDir);
        this.plugin.absolutePythonVenvDir = this.generateAbsolutePythonVenvDir();
        let cmd: string = "python -m venv --clear " + this.plugin.absolutePythonVenvDir;
        commandExecutor.execute(cmd);
        this.plugin.startFakeUpdateProgress();
    }

    private generateAbsolutePythonVenvDir(): string {
        let unixTimestamp: number = Math.floor(Date.now() / 1000);
        let path: string = this.plugin.absolutePythonVenvRootDir + "pvenv" + unixTimestamp + "\\";
        return path;
    }

    public preparePythonEnv(): void {
        this.plugin.checkInterrupt();
        this.plugin.updateProgress("检查Python ...");
        this.plugin.trueEnvPythonVersion = this.checkPython(); 
        let logStr: string = "";
        if (this.plugin.trueEnvPythonVersion === "") {
            logStr = "未检测到任何版本的Python, 请到此<a href=\"" + this.plugin.pythonWinPkgDownloadPage + "\">" 
                + "页面" + "</a>" + "下载并安装最新版Python(" + "版本需>=" + this.plugin.needPythonMinVer + "), "
                + "安装完成后重启思源笔记, 再次运行本插件即可 !"; 
            this.plugin.showHtmlErrMsg(logStr);
            return;
        } else {
            if (this.checkVersionSufficient(this.plugin.trueEnvPythonVersion, this.plugin.needPythonMinVer)) {
                this.plugin.updateProgress("Python版本: " + this.plugin.trueEnvPythonVersion);
            } else {
                logStr = "检测到您目前安装的Python版本为" + this.plugin.trueEnvPythonVersion
                    + ", 低于本插件最低要求的" + this.plugin.needPythonMinVer
                    + "版, 请到此<a href=\"" + this.plugin.pythonWinPkgDownloadPage + "\">"
                    + "页面" + "</a>" + "下载并安装最新版Python, 安装完成后重启思源笔记, 再次运行本插件即可 !";
                this.plugin.showHtmlErrMsg(logStr);
                return;
            }
        }

        if (this.plugin.isAlwaysRecreatePythonVenv) {
            this.plugin.updateProgress("重建Python虚拟环境 ...");
            this.createPythonVenvAsync();
        } else {
            // 检查Python虚拟环境
            this.plugin.updateProgress("检查Python虚拟环境 ...");
            if (!this.isPythonVenvValid()) {
                this.plugin.updateProgress("创建Python虚拟环境 ...");
                this.createPythonVenvAsync();
            } else {
                this.onPythonVenvReady();
            }
        }
    } 

    private checkPvenvPip(): string {
        this.plugin.checkInterrupt();
        let ver: string = "";
        let activateVenvCmd: string = this.plugin.absolutePythonVenvDir + "Scripts\\activate";
        let cmd: string = activateVenvCmd + " && pip --version";
        try {
            let ret: Buffer = execSync(cmd);
            ver = ret.toString().trim();
            ver = ver.split(" ")[1];
            console.log("pip is installed, version: " + ver);
        } catch (err) {
            console.error("pip is not installed !");
        }
        return ver;
    }

    private checkPackageInstalledInPythonVenvAsync(pipPackageName: string): void {
        this.plugin.checkInterrupt();
        let commandExecutor: CommandExecutor = new CommandExecutor();
        this.plugin.cmdExecutors.push(commandExecutor);
        commandExecutor.on("output", (output: string) => {
            this.plugin.checkInterrupt();
            console.log(output);
            this.onCheckPackageInstalledInPythonVenv(pipPackageName, output);
        });
        commandExecutor.on("exit", (code: number) => {
            let logStr: string = "";
            if (code === 0) {
                logStr = "Found: " + pipPackageName;
                console.log(logStr);
                this.plugin.updateProgress(logStr);
                this.onFoundPipPackageInPythonVenv(pipPackageName);
            } else if (code > 0) {
                logStr = "NotFound: " + pipPackageName;
                console.log(logStr);
                this.plugin.updateProgress(logStr);
                this.onNotFoundPipPackageInPythonVenv(pipPackageName);
            } else if (code === null) {
                // 子进程被kill了
            }
        });
        commandExecutor.on("error", (error: string) => {
            if (error.indexOf("WARNING: ") >= 0) {
                console.warn(error);
                this.plugin.updateProgress(error);
            } else {
                console.error(error);
            }
        });

        let activateVenvCmd: string = this.plugin.absolutePythonVenvDir + "Scripts\\activate";
        let cmd: string = activateVenvCmd + " && pip show " + pipPackageName;
        commandExecutor.execute(cmd);
        this.plugin.startFakeUpdateProgress();
    }

    private testPipSourceSpeedAsync(callback): void {
        this.plugin.checkInterrupt();
        this.plugin.pipSourceSpeedTestResult = []; 
        let callbackCalled: boolean = false;
        let startTime: [number, number] = process.hrtime();
        let logStr: string = "";

        if (!this.plugin.isAlwaysUseOfficialPipSource) {
            for (let curSource of this.plugin.pipSources) {
                https.get(curSource, () => {
                    this.plugin.checkInterrupt();
                    let endTime: [number, number] = process.hrtime(startTime);
                    let elapsedMilliseconds: number = Math.round((endTime[0] * 1000) + (endTime[1] / 1000000));
                    let info = {"url": curSource, "elapse": elapsedMilliseconds};
                    this.plugin.pipSourceSpeedTestResult.push(info);
                    logStr = "测速: " + info.url + " - elapse: " + info.elapse;
                    console.log(logStr);
                    this.plugin.updateProgress(logStr);
                    if (!callbackCalled) {
                        callbackCalled = true;
                        this.plugin.curBestPipSourceInfo = info; 
                        callback();
                    }
                }).on("error", (e) => {
                    this.plugin.checkInterrupt();
                    let info = {"url": curSource, "elapse": Number.MAX_VALUE};
                    this.plugin.pipSourceSpeedTestResult.push(info);
                    let logStr: string = "测速: " + info.url + " - elapse: " + info.elapse;
                    this.plugin.updateProgress(logStr);
                    console.warn(logStr);
                    if (this.plugin.pipSourceSpeedTestResult.length === this.plugin.pipSources.length) {
                        // 包括官方源在内的所有源都访问失败, 依然将官方源设为最优源;
                        this.plugin.curBestPipSourceInfo = {"url": curSource, "elapse": 0};
                        logStr = "所有pip源均访问失败, 依然使用官方源 ...";
                        console.log(logStr);
                        this.plugin.updateProgress(logStr);
                        callback();
                    }
                    console.warn("pip source test: " + info.url + "\n" + e.message);
                });
            }
        } else {
            this.plugin.curBestPipSourceInfo = {"url": this.plugin.pipSources[0], "elapse": -1}; 
            logStr = "直接选用官方pip源: " + this.plugin.curBestPipSourceInfo.url;
            callback();
        }
    }

    private checkPvenvMkdocs(): string {
        this.plugin.checkInterrupt();
        let ver: string = "";
        let activateVenvCmd: string = this.plugin.absolutePythonVenvDir + "Scripts\\activate";
        let cmd: string = activateVenvCmd + " && mkdocs --version";
        try {
            let ret: Buffer = execSync(cmd);
            ver = ret.toString().trim();
            ver = ver.split(" ")[2].trim();
            console.log("mkdocs is installed, version: " + ver);
        } catch (err) {
            console.error("mkdocs is not installed !");
        }
        return ver;
    }

    private pipInstallPkgInPvenvAsync(pipPkgName: string, ver: string = ""): void {
        this.plugin.checkInterrupt();
        let commandExecutor: CommandExecutor = new CommandExecutor();
        this.plugin.cmdExecutors.push(commandExecutor);
        commandExecutor.on("output", (output: string) => {
            this.onPipInstallPkgInPvenvOutput(pipPkgName, ver, output);
        });
        commandExecutor.on("exit", (code: number) => {
            if (code === 0) {
                this.onPipInstallPkgInPvenvSuccess(pipPkgName, ver);
            } else if (code > 0) {
                this.onPipInstallPkgInPvenvFailed(pipPkgName, ver, code);
            } else if (code === null) {
            }
        });
        commandExecutor.on("error", (error: string) => {
            if (error.indexOf("WARNING: ") >= 0) {
                console.warn(error);
                this.plugin.updateProgress(error);
            } else {
                this.onPipInstallPkgInPvenvError(pipPkgName, ver, error);
            }
        });

        let activateVenvCmd: string = this.plugin.absolutePythonVenvDir + "Scripts\\activate";
        let verParam: string = "";
        if (!(ver === undefined || ver === null || ver === "")) {
            verParam = "==" + ver;
        }
        let cmd: string = activateVenvCmd + " && pip install " + pipPkgName
            + verParam + " -i " + this.plugin.curBestPipSourceInfo.url;
        commandExecutor.execute(cmd);
        this.plugin.startFakeUpdateProgress();
    }

    private updatePythonVenvPipVerAsync(): void {
        this.plugin.checkInterrupt();
        let commandExecutor: CommandExecutor = new CommandExecutor();
        this.plugin.cmdExecutors.push(commandExecutor);
        commandExecutor.on("output", (output: string) => {
            this.onUpdatePythonVenvPipVerOutput(output);
        });
        commandExecutor.on("exit", (code: number) => {
            if (code === 0) {
                this.onUpdatePythonVenvPipVerSuccess();
            } else if (code > 0) {
                this.onUpdatePythonVenvPipVerFailed(code);
            } else if (code === null) {
            }
        });
        commandExecutor.on("error", (error: string) => {
            if (error.indexOf("WARNING: ") >= 0) {
                console.warn(error);
                this.plugin.updateProgress(error);
            } else {
                this.onUpdatePythonVenvPipVerError(error);
            }
        });

        let parsedUrl: any = url.parse(this.plugin.curBestPipSourceInfo.url);
        let activateVenvCmd: string = this.plugin.absolutePythonVenvDir + "Scripts\\activate";
        let cmd: string = activateVenvCmd + " && python -m pip install --upgrade pip --trusted-host "
            + parsedUrl.hostname + " --index-url " + this.plugin.curBestPipSourceInfo.url;
        commandExecutor.execute(cmd);
        this.plugin.startFakeUpdateProgress();
    }

    private onUpdatePythonVenvPipVerOutput(output: string): void {
        this.plugin.checkInterrupt();
        console.log(output);
        this.plugin.updateProgress(output);
    }

    private onUpdatePythonVenvPipVerSuccess(): void {
        this.plugin.checkInterrupt();
        this.plugin.stopFakeUpdateProgress();
        this.onPythonVenvPipReady();
    }

    private onUpdatePythonVenvPipVerFailed(code: number): void {
        this.plugin.checkInterrupt();
        this.plugin.stopFakeUpdateProgress();
        this.plugin.progressDialog.showErrMsg("更新pip版本失败 ! ");
    }

    private onUpdatePythonVenvPipVerError(error: string): void {
        this.plugin.checkInterrupt();
        console.error(error);
        this.plugin.progressDialog.showErrMsg(error);
        this.plugin.stopAll();
    }

    private onPipInstallPkgInPvenvOutput(pipPkgName: string, ver: string, output: string): void {
        this.plugin.checkInterrupt();
        console.log(output);
        this.plugin.updateProgress(output);
    }

    private onPipInstallPkgInPvenvSuccess(pipPackageName: string, ver: string): void {
        this.plugin.checkInterrupt();
        this.plugin.stopFakeUpdateProgress();
        for (let i = 0; i < this.plugin.mkdocsDeps.length; i++) {
            let curDep: string = this.plugin.mkdocsDeps[i];
            let j: number = i+1;
            if (pipPackageName === "mkdocs") {
                this.pipInstallPkgInPvenvAsync(curDep);
                break;
            }
            if (pipPackageName === curDep) {
                if (j < this.plugin.mkdocsDeps.length) {
                    this.pipInstallPkgInPvenvAsync(this.plugin.mkdocsDeps[j]);
                } else if (j == this.plugin.mkdocsDeps.length) {
                    this.onPythonVenvMkDocsReady();
                }
                break;
            }
        }
    }

    private onPipInstallPkgInPvenvFailed(pipPkgName: string, ver: string, code: number): void {
        this.plugin.checkInterrupt();
        this.plugin.stopFakeUpdateProgress();
    }

    private onPipInstallPkgInPvenvError(pipPkgName: string, ver, error: string): void {
        this.plugin.checkInterrupt();
        console.error(error);
        this.plugin.progressDialog.showErrMsg(error);
        this.plugin.stopAll();
    }

    private onCreatePythonVenvSuccess(): void {
        this.plugin.checkInterrupt();
        this.plugin.stopFakeUpdateProgress();
        this.plugin.updateProgress("创建Python虚拟环境成功 !");

        let data: any = {
            lastpvenvpath: this.plugin.absolutePythonVenvDir,
        };
        this.plugin.saveTheData(STORAGE_2, data).then(() => {
            this.onPythonVenvReady();
        });
    }

    private onCreatePythonVenvFailed(code: number): void {
        this.plugin.checkInterrupt();
        this.plugin.absolutePythonVenvDir = "";
        this.plugin.stopFakeUpdateProgress();
        this.plugin.progressDialog.showErrMsg("创建Python虚拟环境失败 ! ");
    }

    private onCheckPackageInstalledInPythonVenv(pipPkgName: string, output: string): void {
        this.plugin.checkInterrupt();
        this.plugin.updateProgress(output);
    }

    private onFoundPipPackageInPythonVenv(pipPackageName: string): void {
        this.plugin.checkInterrupt();
        this.plugin.stopFakeUpdateProgress();
        for (let i = 0; i < this.plugin.mkdocsDeps.length; i++) {
            let curDep: string = this.plugin.mkdocsDeps[i];
            let j: number = i+1;
            if (pipPackageName === curDep) {
                if (j < this.plugin.mkdocsDeps.length) {
                    this.checkPackageInstalledInPythonVenvAsync(this.plugin.mkdocsDeps[j]);
                } else if (j == this.plugin.mkdocsDeps.length) {
                    this.onPythonVenvMkDocsReady();
                }
                break;
            }
        }
    }

    private onNotFoundPipPackageInPythonVenv(pipPackageName: string): void {
        this.plugin.checkInterrupt();
        this.plugin.stopFakeUpdateProgress();
        this.pipInstallPkgInPvenvAsync(pipPackageName);
        this.plugin.updateProgress("安装" + pipPackageName + " ...");
    }

    private onPythonVenvReady(): void {
        this.plugin.checkInterrupt();
        this.plugin.updateProgress("Python虚拟环境已就绪");
        let ver: string = this.checkPvenvPip();
        if (!this.checkVersionSufficient(ver, this.plugin.needPvenvPipMinVer)) {
            let logStr: string = "虚拟环境pip版本==" + ver + "<" + this.plugin.needPvenvPipMinVer + ", 需更新 ...";
            console.log(logStr);
            this.plugin.updateProgress(logStr);
            this.testPipSourceSpeedAsync(() => {
                this.plugin.checkInterrupt();
                let info: any = this.plugin.curBestPipSourceInfo;
                let logStr: string = "选择pip源: " + info.url + ", 访问耗时: " + info.elapse + "ms";
                console.log(logStr);
                this.plugin.updateProgress(logStr);
                this.updatePythonVenvPipVerAsync();
            });
        } else {
            this.onPythonVenvPipReady();
        }
    }

    private onPythonVenvPipReady(): void {
        this.plugin.updateProgress("准备MkDocs ...");
        let logStr: string = "";
        let isNeedInstall: boolean = false;
        if (this.plugin.isAlwaysReinstallMkDocs) {
            // "重装"只是无条件运行一遍安装命令而已, 并非强制重装(pip install --force-reinstall package_name);
            isNeedInstall = true;
        } else {
            let ver: string = this.checkPvenvMkdocs();
            if (ver === "") {
                logStr = "在当前虚拟环境中未检测到任何版本的MkDocs, 需安装 ...";
                console.log(logStr);
                this.plugin.updateProgress(logStr);
                isNeedInstall = true;
            } else if (!this.checkVersionSufficient(ver, this.plugin.needPvenvMkdocsMinVer)) {
                logStr = "虚拟环境MkDocs版本==" + ver + "<" + this.plugin.needPvenvMkdocsMinVer + ", 需更新 ...";
                console.log(logStr);
                this.plugin.updateProgress(logStr);
                isNeedInstall = true;
            }
        }

        if (isNeedInstall) {
            this.testPipSourceSpeedAsync(() => {
                this.plugin.checkInterrupt();
                let info: any = this.plugin.curBestPipSourceInfo;
                let logStr: string = "选择pip源: " + info.url + ", 访问耗时: " + info.elapse + "ms";
                console.log(logStr);
                this.plugin.updateProgress(logStr);
                this.pipInstallPkgInPvenvAsync("mkdocs", this.plugin.needPvenvMkdocsMinVer);
            });
        } else {
            // 不需要安装MkDocs, 但需要检查其依赖是否需要安装
            this.checkPackageInstalledInPythonVenvAsync(this.plugin.mkdocsDeps[0]);
        }
    }

    private async onPythonVenvMkDocsReady(): Promise<void> {
        this.plugin.checkInterrupt();
        this.plugin.updateProgress("MkDocs已就绪");
        await this.mkdocsAsyncBuilder.generateWebsite();
    }

    private plugin: NoteToWebsitePlugin;
    private mkdocsAsyncBuilder: MkdocsAsyncBuilder;
};