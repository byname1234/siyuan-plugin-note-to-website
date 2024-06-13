import "@/index.scss";
import { Plugin, showMessage, Menu, getFrontend, App, I18N } from "siyuan";
import { Client, IBlob } from "@siyuan-community/siyuan-sdk";
import { getBlockByID, pushErrMsg, pushMsg } from "./api";
import { CommandExecutor } from "./CommandExecutor";
import { InterruptionManager } from "./InterruptionManager";
import { ProgressDialog } from "./ProgressDialog";
import { SettingDialog } from "./SettingDialog";
import { EnvAsyncProcessor } from "./EnvAsyncProcessor";
import PageUtil from "../siyuan/utils/PageUtil";
import * as sy_kernel from '@siyuan-community/siyuan-sdk/src/types/kernel';

export const STORAGE_NAME = "menu-config";
export const STORAGE_2 = "storage_2";
export const client = new Client({});

export default class NoteToWebsitePlugin extends Plugin {
    constructor(options: { app: App, name: string, i18n: I18N}) {
        super(options);
        this.interruptionManager = new InterruptionManager();
        this.envAsyncProcessor = new EnvAsyncProcessor();
    } 

    public async onload(): Promise<void> {
        this.data[STORAGE_NAME] = { readonlyText: "Readonly" };
        await this.loadData(STORAGE_NAME);
        let data: any = this.data[STORAGE_NAME]; 
        if (data.userEverSavedFlag === undefined 
            || data.userEverSavedFlag === null 
            || data.userEverSavedFlag !== "1") {
            await this.saveTheDefaultData();
        }
        const frontEnd = getFrontend();
        this._isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
        this.addIcons(`
          <symbol id="icon" viewBox="0 0 384 512">
            <path d="M0 32l34.9 395.8L191.5 480l157.6-52.2L384 32H0zm308.2 127.9H124.4l4.1 49.4h175.6l-13.6 148.4-97.9 27v.3h-1.1l-98.7-27.3-6-75.8h47.7L138 320l53.5 14.5 53.7-14.5 6-62.2H84.3L71.5 112.2h241.1l-4.4 47.7z"/></path>
          </symbol>
          <symbol id="icon2" viewBox="0 0 576 512">
            <path d="M413.5 237.5c-28.2 4.8-58.2-3.6-80-25.4l-38.1-38.1C280.4 159 272 138.8 272 117.6V105.5L192.3 62c-5.3-2.9-8.6-8.6-8.3-14.7s3.9-11.5 9.5-14l47.2-21C259.1 4.2 279 0 299.2 0h18.1c36.7 0 72 14 98.7 39.1l44.6 42c24.2 22.8 33.2 55.7 26.6 86L503 183l8-8c9.4-9.4 24.6-9.4 33.9 0l24 24c9.4 9.4 9.4 24.6 0 33.9l-88 88c-9.4 9.4-24.6 9.4-33.9 0l-24-24c-9.4-9.4-9.4-24.6 0-33.9l8-8-17.5-17.5zM27.4 377.1L260.9 182.6c3.5 4.9 7.5 9.6 11.8 14l38.1 38.1c6 6 12.4 11.2 19.2 15.7L134.9 484.6c-14.5 17.4-36 27.4-58.6 27.4C34.1 512 0 477.8 0 435.7c0-22.6 10.1-44.1 27.4-58.6z"/></path>
          </symbol>
          <symbol id="icon3" viewBox="0 0 160 160"">
            <path d="M 22.881 1.503 C 17.297 4.538, 17 6.651, 17 43.401 L 17 77 9.700 77 C 5.356 77, 1.914 77.486, 1.200 78.200 C -0.507 79.907, -0.507 129.093, 1.200 130.800 C 1.914 131.514, 5.356 132, 9.700 132 L 17 132 17 141.099 C 17 151.527, 18.647 156.249, 23.085 158.544 C 25.451 159.767, 34.774 160, 81.435 160 L 136.968 160 140.234 157.084 L 143.500 154.168 143.838 143.084 L 144.177 132 150.933 132 C 161.378 132, 161 133.085, 161 103.112 C 161 87.795, 160.634 78.108, 160.069 78.457 C 159.557 78.774, 158.856 78.575, 158.510 78.016 C 158.165 77.457, 154.759 77, 150.941 77 L 144 77 144 61.517 L 144 46.033 116.412 23.017 L 88.824 0 57.162 0.040 C 31.731 0.072, 24.985 0.360, 22.881 1.503 M 25.476 3.388 C 20.193 5.703, 20 7.121, 20 43.547 L 20 77 80.500 77 L 141 77 141 62 L 141 47 114.519 47 L 88.038 47 87.769 24.750 L 87.500 2.500 58 2.281 C 35.300 2.113, 27.803 2.368, 25.476 3.388 M 28 18 C 28 18.634, 35.500 19, 48.500 19 C 61.500 19, 69 18.634, 69 18 C 69 17.366, 61.500 17, 48.500 17 C 35.500 17, 28 17.366, 28 18 M 28 23 C 28 23.634, 35.500 24, 48.500 24 C 61.500 24, 69 23.634, 69 23 C 69 22.366, 61.500 22, 48.500 22 C 35.500 22, 28 22.366, 28 23 M 28 27 C 28 27.634, 35.500 28, 48.500 28 C 61.500 28, 69 27.634, 69 27 C 69 26.366, 61.500 26, 48.500 26 C 35.500 26, 28 26.366, 28 27 M 28.653 31.235 C 28.019 31.639, 36.913 31.976, 48.417 31.985 C 59.921 31.993, 69.098 31.765, 68.811 31.477 C 67.982 30.649, 29.933 30.419, 28.653 31.235 M 28 36 C 28 36.634, 35.500 37, 48.500 37 C 61.500 37, 69 36.634, 69 36 C 69 35.366, 61.500 35, 48.500 35 C 35.500 35, 28 35.366, 28 36 M 28 40 C 28 40.634, 35.500 41, 48.500 41 C 61.500 41, 69 40.634, 69 40 C 69 39.366, 61.500 39, 48.500 39 C 35.500 39, 28 39.366, 28 40 M 0.436 104.500 C 0.436 118.800, 0.577 124.511, 0.748 117.191 C 0.919 109.871, 0.918 98.171, 0.747 91.191 C 0.575 84.211, 0.435 90.200, 0.436 104.500 M 26 104.500 L 26 117 30 117 L 34 117 34 112 L 34 107 38 107 L 42 107 42 112 L 42 117 46 117 L 50 117 50 104.440 L 50 91.879 46.250 92.190 C 42.610 92.491, 42.491 92.625, 42.193 96.750 C 41.886 100.979, 41.866 101, 37.943 101 L 34 101 34 96.500 L 34 92 30 92 L 26 92 26 104.500 M 54 94.940 C 54 97.615, 54.337 97.907, 57.750 98.190 L 61.500 98.500 61.788 107.750 L 62.075 117 65.500 117 L 68.925 117 69.212 107.750 L 69.500 98.500 73.250 98.190 C 76.663 97.907, 77 97.615, 77 94.940 L 77 92 65.500 92 L 54 92 54 94.940 M 81 104.500 L 81 117 84 117 L 87 117 87.096 108.250 L 87.191 99.500 89.393 108 C 91.518 116.206, 91.700 116.511, 94.676 116.804 C 97.721 117.105, 97.780 117.022, 99.629 109.804 L 101.500 102.500 101.794 109.750 L 102.088 117 105.544 117 L 109 117 109 104.500 L 109 92 103.969 92 C 100.824 92, 98.787 92.469, 98.537 93.250 C 98.317 93.938, 97.366 97.200, 96.425 100.500 L 94.712 106.500 93.795 103 C 93.290 101.075, 92.438 97.813, 91.900 95.750 C 90.936 92.052, 90.854 92, 85.961 92 L 81 92 81 104.500 M 114 104.500 L 114 117 124 117 L 134 117 134 114 L 134 111 128 111 L 122 111 122 101.500 L 122 92 118 92 L 114 92 114 104.500 M 20 141.050 C 20 152.338, 21.380 155.487, 26.990 156.997 C 29.645 157.712, 48.448 157.974, 83.570 157.784 L 136.174 157.500 138.587 154.694 C 140.788 152.135, 141 151.014, 141 141.944 L 141 132 80.500 132 L 20 132 20 141.050 M 54 144 C 54 144.641, 63.353 145, 80.059 145 C 97.177 145, 105.906 144.657, 105.500 144 C 105.114 143.376, 95.323 143, 79.441 143 C 63.147 143, 54 143.360, 54 144 M 64.250 148.748 C 72.912 148.915, 87.087 148.915, 95.750 148.748 C 104.412 148.582, 97.325 148.445, 80 148.445 C 62.675 148.445, 55.587 148.582, 64.250 148.748" stroke="none" fill="#252524" fill-rule="evenodd"/><path d="M 25.476 3.388 C 20.193 5.703, 20 7.121, 20 43.547 L 20 77 80.500 77 L 141 77 141 62 L 141 47 114.519 47 L 88.038 47 87.769 24.750 L 87.500 2.500 58 2.281 C 35.300 2.113, 27.803 2.368, 25.476 3.388 M 28 18 C 28 18.634, 35.500 19, 48.500 19 C 61.500 19, 69 18.634, 69 18 C 69 17.366, 61.500 17, 48.500 17 C 35.500 17, 28 17.366, 28 18 M 28 23 C 28 23.634, 35.500 24, 48.500 24 C 61.500 24, 69 23.634, 69 23 C 69 22.366, 61.500 22, 48.500 22 C 35.500 22, 28 22.366, 28 23 M 28 27 C 28 27.634, 35.500 28, 48.500 28 C 61.500 28, 69 27.634, 69 27 C 69 26.366, 61.500 26, 48.500 26 C 35.500 26, 28 26.366, 28 27 M 28.653 31.235 C 28.019 31.639, 36.913 31.976, 48.417 31.985 C 59.921 31.993, 69.098 31.765, 68.811 31.477 C 67.982 30.649, 29.933 30.419, 28.653 31.235 M 28 36 C 28 36.634, 35.500 37, 48.500 37 C 61.500 37, 69 36.634, 69 36 C 69 35.366, 61.500 35, 48.500 35 C 35.500 35, 28 35.366, 28 36 M 28 40 C 28 40.634, 35.500 41, 48.500 41 C 61.500 41, 69 40.634, 69 40 C 69 39.366, 61.500 39, 48.500 39 C 35.500 39, 28 39.366, 28 40 M 26 104.500 L 26 117 30 117 L 34 117 34 112 L 34 107 38 107 L 42 107 42 112 L 42 117 46 117 L 50 117 50 104.440 L 50 91.879 46.250 92.190 C 42.610 92.491, 42.491 92.625, 42.193 96.750 C 41.886 100.979, 41.866 101, 37.943 101 L 34 101 34 96.500 L 34 92 30 92 L 26 92 26 104.500 M 54 94.940 C 54 97.615, 54.337 97.907, 57.750 98.190 L 61.500 98.500 61.788 107.750 L 62.075 117 65.500 117 L 68.925 117 69.212 107.750 L 69.500 98.500 73.250 98.190 C 76.663 97.907, 77 97.615, 77 94.940 L 77 92 65.500 92 L 54 92 54 94.940 M 81 104.500 L 81 117 84 117 L 87 117 87.096 108.250 L 87.191 99.500 89.393 108 C 91.518 116.206, 91.700 116.511, 94.676 116.804 C 97.721 117.105, 97.780 117.022, 99.629 109.804 L 101.500 102.500 101.794 109.750 L 102.088 117 105.544 117 L 109 117 109 104.500 L 109 92 103.969 92 C 100.824 92, 98.787 92.469, 98.537 93.250 C 98.317 93.938, 97.366 97.200, 96.425 100.500 L 94.712 106.500 93.795 103 C 93.290 101.075, 92.438 97.813, 91.900 95.750 C 90.936 92.052, 90.854 92, 85.961 92 L 81 92 81 104.500 M 114 104.500 L 114 117 124 117 L 134 117 134 114 L 134 111 128 111 L 122 111 122 101.500 L 122 92 118 92 L 114 92 114 104.500 M 20 141.050 C 20 152.338, 21.380 155.487, 26.990 156.997 C 29.645 157.712, 48.448 157.974, 83.570 157.784 L 136.174 157.500 138.587 154.694 C 140.788 152.135, 141 151.014, 141 141.944 L 141 132 80.500 132 L 20 132 20 141.050 M 54 144 C 54 144.641, 63.353 145, 80.059 145 C 97.177 145, 105.906 144.657, 105.500 144 C 105.114 143.376, 95.323 143, 79.441 143 C 63.147 143, 54 143.360, 54 144 M 64.250 148.748 C 72.912 148.915, 87.087 148.915, 95.750 148.748 C 104.412 148.582, 97.325 148.445, 80 148.445 C 62.675 148.445, 55.587 148.582, 64.250 148.748" stroke="none" fill="#f5ce70" fill-rule="evenodd"/>
          </symbol>
        `);

        const topBarElement = this.addTopBar({
            icon: "icon3",
            title: this.i18n.addTopBarIcon,
            position: "left",

            callback: () => {
                if (!this.isMobile) {
                    let rect = topBarElement.getBoundingClientRect();
                    // 如果被隐藏，则使用更多按钮
                    if (rect.width === 0) {
                        rect = document.querySelector("#barMore").getBoundingClientRect();
                    }
                    if (rect.width === 0) {
                        rect = document.querySelector("#barPlugins").getBoundingClientRect();
                    }
                    this.addMenu(rect);
                }
            }
        });
    }

    public async onunload(): Promise<void> {
        console.log(this.i18n.byePlugin);
        showMessage("Goodbye SiYuan Plugin");
        console.log("onunload");
    }

    public uninstall(): void {
        console.log("uninstall");
    }

    private openProgressDialog(): void {
        this._progressDialog = new ProgressDialog(this);
        this._progressDialog.init();
    }

    private openSettingDialog(): void {
        this.settingDialog = new SettingDialog(this);
        this.settingDialog.init();
    }

    public openSetting(): void {
        this.openSettingDialog();
    }

    private addMenu(rect?: DOMRect) {
        const menu = new Menu("topBar", () => {
            console.log(this.i18n.byeMenu);
        });

        if (!this.isMobile) {
            menu.addItem({
                icon: "icon2",
                label: "生成网站",
                click: async () => {
                    let logStr: string = "";
                    if (!await this.init()) {
                        logStr = "Init failed !";
                        console.error(logStr);
                        return;
                    }
                    this.openProgressDialog();
                    this.progressDialog.updateProgress("初始化完成 !");
                    if (this.osName !== "windows" || this.isMobile) {
                        logStr = "Can't support this os: " + this.osName + ", " + this.osPlatform;
                        console.error(logStr);
                        this.progressDialog.showErrMsg("本插件目前仅支持Windows桌面系统!!!");
                        return;
                    }
                    this.envAsyncProcessor.preparePythonEnv();
                }
            });
        }
        
        menu.addItem({
            icon: "iconSettings",
            label: "设置",
            click: () => {
                this.openSettingDialog();
            }
        });

        if (!this.isMobile) {
            menu.open({
                x: rect.right,
                y: rect.bottom,
                isLeft: true,
            });
        }
    } 

    public stopAll(): void {
        this.killAllSubProcess();
        this.interruptCurrentExecution();
        this.stopAllInterval();
    } 
    
    private async init(): Promise<boolean> {
        let curRootDocId: string = PageUtil.getPageId();
        if (curRootDocId === undefined || curRootDocId === null 
            || curRootDocId === "") {
            console.error("Cur root doc id=" + curRootDocId + ", is invalid !");
            this.showErrMsg("您尚未打开任何笔记, 请打开后再试 !");
            return false;
        }
        this._curRootDoc = await getBlockByID(curRootDocId);
        if (this.curRootDoc === undefined || this.curRootDoc === null) {
            console.error("Cur root doc obj=" + this.curRootDoc + ", is invalid !");
            return false;
        }

        this._websiteNameDefault = "MySite";
        this._websiteLogoFileNameDefault = "logo.png"; 
        this._websiteIconFileNameDefault = "icon.png"; 
        this._websiteEngineDefault = "mkdocs";
        this._websiteFooterDefault = "<a href=\"\"><i><< index</i></a>";
        this._isAlwaysRecreatePythonVenvDefault = false;
        this._isAlwaysReinstallMkDocsDefault = false;
        this._isAlwaysOpenWebsiteDirDefault = true;

        this._pipSources = [
            "https://pypi.org/simple", // 官方源 
            "https://pypi.tuna.tsinghua.edu.cn/simple",
            "https://mirrors.aliyun.com/pypi/simple",
            "https://pypi.lanzoub.com/simple",
            "https://mirrors.cloud.tencent.com/pypi/simple",
            "https://pypi.huaweicloud.com/repository/pypi/simple",
            "https://pypi.cae.cn/pypi/simple",
            "https://pypi.mirrors.zju.edu.cn/simple",
            "https://pypi.douban.com/simple",
            "https://pypi.mirrors.ustc.edu.cn/simple"
        ];
        this._curBestPipSourceInfo = {"url": this.pipSources[0], "elapse": -1};
        this._isAlwaysUseOfficialPipSource = false;

        // 3.4及后续版本同时内置了venv和pip;
        // 经测试, 3.7版是可正常执行完整流程的最低版本, 不过此版自带的
        // pip版本过旧, 需要多一步更新pip版本的操作, 用户在使用时最好安
        // 装最新版的Python, 最新版包含了最新的pip版本, 最新的mkdocs版本;  
        //
        // 注意: 版本号必须用数字表示, 例如, 要表示最低版为3.7系列的版本, 应该用3.7.0而不是3.7.x;
        this._needPythonMinVer = "3.7.0"; // 3.7.0
        this._needPvenvPipMinVer = "24.0";
        this._needPvenvMkdocsMinVer = "1.6.0";

        this._trueEnvPythonVersion = "";
        this._pythonWinPkgDownloadPage = "https://www.python.org/downloads/windows";

        this.msgTimeout = -1;
        this.errorMsgTimeout = -1;
        this._allBlocksOfRootDoc = {};
        this._cmdExecutors = [];
        this._pipSourceSpeedTestResult = [];

        this.interruptionManager.init();
        this.envAsyncProcessor.init(this);

        let logStr: string = "";
        let globalConf: sy_kernel.api.system.getConf.IResponse = await client.getConf();
        if (globalConf === undefined || globalConf === null) {
            logStr = "Get siyuan global conf failed !";
            console.error(logStr);
            return false;
        }

        await this.loadData(STORAGE_2);
        let data: any = this.data[STORAGE_2]; 
        this.osName = globalConf.data.conf.system.os;
        this.osPlatform = globalConf.data.conf.system.osPlatform;
        this.queryDBResultLimit = globalConf.data.conf.search.limit as number;
        this.absoluteWorkspaceDir = globalConf.data.conf.system.workspaceDir + "\\";
        this.absoluteConfDir = globalConf.data.conf.system.confDir + "\\";
        this.absoluteDataDir = globalConf.data.conf.system.dataDir + "\\";
        this.absoluteTempDir = globalConf.data.conf.system.workspaceDir + "\\temp\\";
        this.pluginWorkDirName = "siyuan-to-website";
        this._pluginWorkDir = "temp/" + this.pluginWorkDirName + "/";
        this._absolutePluginWorkDir = this.absoluteWorkspaceDir + "temp\\" + this.pluginWorkDirName + "\\";
        this._absolutePythonVenvRootDir = this.absolutePluginWorkDir + "pvenv\\";
        this._absolutePythonVenvDir = data.lastpvenvpath;
        this._absoluteGenWebsiteDir = this.absolutePluginWorkDir + this.curRootDoc.content + "\\site";

        logStr = "Operator system: " + this.osName;
        console.info(logStr);

        logStr = "Operator system platform: " + this.osPlatform;
        console.info(logStr);

        logStr = "Workspace absolute dir: " + this.absoluteWorkspaceDir;
        console.info(logStr);

        logStr = "Conf absolute dir: " + this.absoluteConfDir;
        console.info(logStr);

        logStr = "Data absolute dir: " + this.absoluteDataDir;
        console.info(logStr);

        logStr = "Temp absolute dir: " + this.absoluteTempDir;
        console.info(logStr);

        logStr = "Python venv absolute root dir: " + this.absolutePythonVenvRootDir;
        console.info(logStr);

        logStr = "Python venv absolute dir: " + this.absolutePythonVenvDir;
        console.info(logStr);

        logStr = "Plugin absolute work dir: " + this.absolutePluginWorkDir;
        console.info(logStr);

        logStr = "Generated website absolute dir: " + this.absoluteGenWebsiteDir;
        console.info(logStr);

        logStr = "Plugin work dir: " + this.pluginWorkDir;
        console.info(logStr); 

        logStr = "Query db result limit: " + this.queryDBResultLimit;
        console.info(logStr); 

        await this.loadData(STORAGE_NAME);
        data = this.data[STORAGE_NAME]; 
        logStr = "Plugin conf -> websitename";
        if (data.websitename === undefined || data.websitename === null) {
            logStr += " is undefined or null !"
            console.error(logStr);
            return false;
        }
        this._websiteName = data.websitename; 
        logStr = logStr + ": " + this.websiteName;
        console.info(logStr);

        logStr = "Plugin conf -> websiteengine";
        if (data.websiteengine === undefined || data.websiteengine === null) {
            logStr += " is undefined or null !"
            console.error(logStr);
            return false;
        }
        this._websiteEngine = data.websiteengine;
        logStr = logStr + ": " + this.websiteEngine;
        console.info(logStr);

        logStr = "Plugin conf -> websitelogofilename";
        if (data.websitelogofilename === undefined || data.websitelogofilename === null) {
            logStr += " is undefined or null !"
            console.error(logStr);
            return false;
        }
        this._websiteLogoFileName = data.websitelogofilename;
        logStr = logStr + ": " + this.websiteLogoFileName;
        console.info(logStr);

        logStr = "Plugin conf -> websiteiconfilename";
        if (data.websiteiconfilename === undefined || data.websiteiconfilename === null) {
            logStr += " is undefined or null !"
            console.error(logStr);
            return false;
        }
        this._websiteIconFileName = data.websiteiconfilename;
        logStr = logStr + ": " + this.websiteIconFileName;
        console.info(logStr);

        logStr = "Plugin conf -> websitefooter";
        if (data.websitefooter === undefined || data.websitefooter === null) {
            logStr += " is undefined or null !"
            console.error(logStr);
            return false;
        }
        this._websiteFooter = data.websitefooter;
        logStr = logStr + ": " + this.websiteFooter;
        console.info(logStr);

        logStr = "Plugin conf -> isalwaysopenwebsitedir";
        if (data.isalwaysopenwebsitedir === undefined 
            || data.isalwaysopenwebsitedir === null) {
            logStr += " is undefined or null !"
            console.error(logStr);
            return false;
        }
        this._isAlwaysOpenWebsiteDir = data.isalwaysopenwebsitedir;
        logStr = logStr + ": " + this.isAlwaysOpenWebsiteDir;
        console.info(logStr);

        logStr = "Plugin conf -> isalwaysrecreatepythonvenv";
        if (data.isalwaysrecreatepythonvenv === undefined 
            || data.isalwaysrecreatepythonvenv === null) {
            logStr += " is undefined or null !"
            console.error(logStr);
            return false;
        }
        this._isAlwaysRecreatePythonVenv = data.isalwaysrecreatepythonvenv;
        logStr = logStr + ": " + this.isAlwaysRecreatePythonVenv;
        console.info(logStr);

        logStr = "Plugin conf -> isalwaysreinstallmkdocs";
        if (data.isalwaysreinstallmkdocs === undefined 
            || data.isalwaysreinstallmkdocs === null) {
            logStr += " is undefined or null !"
            console.error(logStr);
            return false;
        }
        this._isAlwaysReinstallMkDocs = data.isalwaysreinstallmkdocs;
        logStr = logStr + ": " + this.isAlwaysReinstallMkDocs;
        console.info(logStr);

        logStr = "Plugin conf -> websiteimgadjustparam";
        if (data.websiteimgadjustparam === undefined 
            || data.websiteimgadjustparam === null) {
            logStr += " is undefined or null !"
            console.error(logStr);
            return false;
        }
        this._websiteImgAdjustParam = data.websiteimgadjustparam;
        logStr = logStr + ": " + this.websiteImgAdjustParam;
        console.info(logStr);

        this._mkdocsDeps = [
            "mkdocs-glightbox", 
            "mkdocs-material",
            // MkDocs默认渲染器在渲染列表时, 以四空格缩进为准, 使用此插件可令其支持两空格缩进;
            "mdx_truly_sane_lists" 
        ];
        return true;
    }  

    public showErrMsg(msg: string): void {
        this.checkInterrupt();
        pushErrMsg(msg, this.errorMsgTimeout);
    }

    private showMsg(msg: string): void {
        this.checkInterrupt();
        pushMsg(msg, this.msgTimeout);
    } 

    public killAllSubProcess(): void {
        if (!(this.cmdExecutors === undefined || this.cmdExecutors === null)) {
            for (let curExecutor of this.cmdExecutors) {
                if (curExecutor === undefined || curExecutor === null) {
                    continue;
                }
                curExecutor.kill();
            }
        }
    }

    public stopAllInterval(): void {
        this.progressDialog.stopFakeUpdateProgress();
    }

    public interruptCurrentExecution(): void {
        if (!(this.interruptionManager === undefined || this.interruptionManager === null)) {
            this.interruptionManager.stop();
        }
    }

    public checkInterrupt(): void {
        if (!(this.interruptionManager === undefined || this.interruptionManager === null)) {
            this.interruptionManager.check();
        }
    } 

    private async saveTheDefaultData(): Promise<void> {
        let data = {
            userEverSavedFlag: "1",
            websitename: this.websiteNameDefault,
            websitelogofilename: this.websiteLogoFileNameDefault,
            websiteiconfilename: this.websiteIconFileNameDefault,
            websitefooter: this.websiteFooterDefault,
            websiteengine: this.websiteEngineDefault,
            isalwaysopenwebsitedir: this.isAlwaysOpenWebsiteDirDefault,
            isalwaysrecreatepythonvenv: this.isAlwaysRecreatePythonVenvDefault,
            isalwaysreinstallmkdocs: this.isAlwaysReinstallMkDocsDefault,
            websiteimgadjustparam: this.websiteImgAdjustParamDefault
        };

        console.log("save....");
        await this.saveData(STORAGE_NAME, data);
    }

    public async saveTheData(storageName: string, content: any): Promise<void> {
        await this.saveData(storageName, content);
    }

    public updateProgress(msg: string = "", addTotalStepCnt: number = 1): void {
        if (this.progressDialog !== undefined || this.progressDialog !== null) {
            this.progressDialog.updateProgress(msg, addTotalStepCnt);
        }
    }

    public showHtmlErrMsg(content: string): void {
        if (this.progressDialog !== undefined || this.progressDialog !== null) {
            this.progressDialog.showHtmlErrMsg(content);
        }
    }

    public startFakeUpdateProgress(intervalMs: number = 70): void {
        if (this.progressDialog !== undefined || this.progressDialog !== null) {
            this.progressDialog.startFakeUpdateProgress(intervalMs);
        }
    }

    public stopFakeUpdateProgress(): void {
        if (this.progressDialog !== undefined || this.progressDialog !== null) {
            this.progressDialog.stopFakeUpdateProgress();
        }
    }

    public async getFile(payload: sy_kernel.api.file.getFile.IPayload): Promise<IBlob> {
        return await client.getFile(payload, "blob");
    }

    public async putFile(payload: sy_kernel.api.file.putFile.IPayload): Promise<sy_kernel.api.file.putFile.IResponse> {
        return await client.putFile(payload);
    }

    public calTotalCntOfBlocks(): number {
        let cnt: number = 0;
        for (const key in this._allBlocksOfRootDoc) {
            if (this._allBlocksOfRootDoc.hasOwnProperty(key)) {
                cnt += this._allBlocksOfRootDoc[key].length;
            }
        }
        return cnt;
    }

    public get isMobile(): boolean {
        return this._isMobile;
    }

    public get websiteName(): string {
        return this._websiteName;
    }

    public get pluginWorkDir(): string {
        return this._pluginWorkDir;
    }

    public get websiteFooter(): string {
        return this._websiteFooter;
    }

    public get websiteLogoFileName(): string {
        return this._websiteLogoFileName;
    }

    public get websiteIconFileName(): string {
        return this._websiteIconFileName;
    }

    public get curRootDoc(): Block {
        return this._curRootDoc; 
    }

    public get websiteImgAdjustParam(): number {
        return this._websiteImgAdjustParam;
    }

    public get websiteNameDefault(): string {
        return this._websiteNameDefault;
    }

    public get websiteLogoFileNameDefault(): string {
        return this._websiteLogoFileNameDefault
    }

    public get websiteIconFileNameDefault(): string {
        return this._websiteIconFileNameDefault
    }

    public get websiteEngineDefault(): string {
        return this._websiteEngineDefault
    } 

    public get websiteFooterDefault(): string {
        return this._websiteFooterDefault
    } 

    public get isAlwaysRecreatePythonVenvDefault(): boolean {
        return this._isAlwaysRecreatePythonVenvDefault;
    }

    public get isAlwaysReinstallMkDocsDefault(): boolean {
        return this._isAlwaysReinstallMkDocsDefault
    } 

    public get isAlwaysOpenWebsiteDirDefault(): boolean {
        return this._isAlwaysOpenWebsiteDirDefault
    }

    public get websiteImgAdjustParamDefault(): number {
        return this._websiteImgAdjustParamDefault
    }

    public get websiteEngine(): string {
        return this._websiteEngine;
    }

    public get isAlwaysRecreatePythonVenv(): boolean {
        return this._isAlwaysRecreatePythonVenv;
    }

    public get isAlwaysOpenWebsiteDir(): boolean {
        return this._isAlwaysOpenWebsiteDir;
    }

    public get isAlwaysReinstallMkDocs(): boolean {
        return this._isAlwaysReinstallMkDocs;
    }

    public get trueEnvPythonVersion(): string {
        return this._trueEnvPythonVersion;
    }

    public set trueEnvPythonVersion(value: string) {
        this._trueEnvPythonVersion = value;
    }

    public get pythonWinPkgDownloadPage(): string {
        return this._pythonWinPkgDownloadPage;
    }

    public get needPythonMinVer(): string {
        return this._needPythonMinVer;
    }

    public get absolutePythonVenvDir(): string {
        return this._absolutePythonVenvDir; 
    }

    public set absolutePythonVenvDir(value: string) {
        this._absolutePythonVenvDir = value; 
    }

    public get absolutePythonVenvRootDir(): string {
        return this._absolutePythonVenvRootDir;
    }

    public get needPvenvPipMinVer(): string {
        return this._needPvenvPipMinVer;
    }

    public get curBestPipSourceInfo(): any {
        return this._curBestPipSourceInfo; 
    }

    public set curBestPipSourceInfo(value: any) {
        this._curBestPipSourceInfo = value;
    }

    public get pipSourceSpeedTestResult(): any[] {
        return this._pipSourceSpeedTestResult; 
    }

    public set pipSourceSpeedTestResult(value: any[]) {
        this._pipSourceSpeedTestResult = value;
    }

    public get isAlwaysUseOfficialPipSource(): boolean {
        return this._isAlwaysUseOfficialPipSource;
    }

    public get pipSources(): string[] {
        return this._pipSources;
    }

    public get needPvenvMkdocsMinVer(): string {
        return this._needPvenvMkdocsMinVer; 
    }

    public get mkdocsDeps(): string[] {
        return this._mkdocsDeps;
    }

    public get cmdExecutors(): CommandExecutor[] {
        return this._cmdExecutors;
    }

    public get allBlocksOfRootDoc(): {} {
        return this._allBlocksOfRootDoc;
    }

    public get absolutePluginWorkDir(): string {
        return this._absolutePluginWorkDir;
    }

    public get absoluteGenWebsiteDir(): string {
        return this._absoluteGenWebsiteDir;
    }

    public get progressDialog(): ProgressDialog {
        return this._progressDialog;
    }

    private _websiteNameDefault: string = "MySite";
    private _websiteLogoFileNameDefault: string = "logo.png"; 
    private _websiteIconFileNameDefault: string = "icon.png"; 
    private _websiteEngineDefault: string = "mkdocs";
    private _websiteFooterDefault: string = "<a href=\"\"><i><< index</i></a>";
    private _isAlwaysRecreatePythonVenvDefault: boolean = false;
    private _isAlwaysReinstallMkDocsDefault: boolean = false;
    private _isAlwaysOpenWebsiteDirDefault: boolean = true;
    private _websiteImgAdjustParamDefault: number = 20;
    // 在原width的基础上加param, 这个数值是通过实验得到的, 无理论依据,
    // 加上此值后, 生成的HTML中的图片尺寸与笔记中的展示效果比较接近,
    // 若发现网站中的图片与笔记中的大小有出入, 可通过param值来调整;
    private _websiteImgAdjustParam: number;
    private _curRootDoc: Block;
    private _isMobile: boolean;
    private _pluginWorkDir: string;
    private _websiteName: string;
    private _websiteFooter: string;
    private _websiteLogoFileName: string; 
    private _websiteIconFileName: string;
    private _websiteEngine: string;
    private _isAlwaysRecreatePythonVenv: boolean;
    private _isAlwaysOpenWebsiteDir: boolean;
    private _isAlwaysReinstallMkDocs: boolean;
    private _trueEnvPythonVersion: string;
    private _pythonWinPkgDownloadPage: string;
    private _needPythonMinVer: string; // 所需Python的最低版本
    private _absolutePythonVenvDir: string;
    private _absolutePythonVenvRootDir: string; 
    private _needPvenvPipMinVer: string;
    private _curBestPipSourceInfo: any; // 经测速得到的最优源;
    private _pipSourceSpeedTestResult: any[];
    private _isAlwaysUseOfficialPipSource: boolean;
    private _pipSources: string[];
    private _needPvenvMkdocsMinVer: string;
    private _mkdocsDeps: string[]; // MkDocs需要安装的依赖
    private _cmdExecutors: CommandExecutor[];
    private _allBlocksOfRootDoc: { [key: string]: Block[] }; 
    private _absolutePluginWorkDir: string;
    private _absoluteGenWebsiteDir: string; 
    private _progressDialog: ProgressDialog;
    private interruptionManager: InterruptionManager;
    private settingDialog: SettingDialog;
    private envAsyncProcessor: EnvAsyncProcessor;
    private pluginWorkDirName: string;
    private absoluteWorkspaceDir: string; 
    private absoluteConfDir: string; 
    private absoluteDataDir: string; 
    private absoluteTempDir: string; 
    private osName: string; // 当前操作系统名字
    private osPlatform: string;
    private queryDBResultLimit: number; // 通过数据库查询结果数的上限, 思源默认为64
    private msgTimeout: number; // 普通消息框展示时间(ms);
    private errorMsgTimeout: number; // 错误消息框展示时间(ms);
};