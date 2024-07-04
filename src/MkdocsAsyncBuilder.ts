import { exportMdContent, getBlockByID, getChildBlocks, putFile } from "./api";
import { MkdocsProcessor } from "./MkdocsProcessor";
import { CommandExecutor } from "./CommandExecutor";
import { DocContentProcessor } from "./DocContentProcessor";
import { deleteDirectorySync } from "./MyTools";
import * as sy_kernel from '@siyuan-community/siyuan-sdk/src/types/kernel';
import NoteToWebsitePlugin, { client } from "./index";
const { execSync } = require("child_process");

export class MkdocsAsyncBuilder {
    constructor() {
        this.docContentProcessor = new DocContentProcessor();
        this.mkdocsProcessor = new MkdocsProcessor();
    }

    public init(plugin: NoteToWebsitePlugin): boolean {
        if (plugin === undefined || plugin === null) {
            return false;
        }
        this.plugin = plugin;
        this.docContentProcessor.init(plugin);
        this.mkdocsProcessor.init(plugin);
        return true;
    }

    private delOldWebsiteDir(): void {
        this.plugin.checkInterrupt();
        let path: string = this.plugin.absolutePluginWorkDir+this.plugin.curRootDoc.content;
        deleteDirectorySync(path);
    }

    private async processContentOfDoc(doc: Block): Promise<string> {
        this.plugin.checkInterrupt();
        if (doc === undefined || doc === null) {
            return "";
        }
        if (doc.type !== "d") {
            return "";
        }

        let newDocContent: string = await this.docContentProcessor.doProcess(doc);
        return newDocContent;
    } 

    private calDocCount(blocks: Block[]): number {
        this.plugin.checkInterrupt();
        if (blocks === undefined || blocks === null) {
            return 0;
        }
        let cnt: number = 0;
        for (let curBlock of blocks) {
            if (curBlock.type === "d") {
                cnt++;
            }
        }
        return cnt;
    }

    /**
     * 获取本文档内所有块, 包括: 本文档自身, 本文档的子文档, 本文档块中的子块 ...
     * 
     * @async
     * @param {Block} doc - 文档对象
     * @param {[key: string]: Block[]} blocks - 块对象表, 以文档块id为key, 文档块中的子块对象数组为value; 
     * @returns {Promise<void>}
     */
    private async getAllBlocksOfDoc(doc: Block, blocks: {[key: string]: Block[]}): Promise<void> {
        this.plugin.checkInterrupt();
        if (doc === undefined || doc === null) {
            return;
        }
        if (!("type" in doc && "id" in doc)) {
            return;
        }
        if (doc.type !== "d") {
            return;
        }

        if (blocks[doc.id] === undefined || blocks[doc.id] === null) {
            blocks[doc.id] = [];
        }
        blocks[doc.id].push(doc);
        let nodebookId: string = doc.box;
        let payload: sy_kernel.api.filetree.listDocsByPath.IPayload = {
            notebook: nodebookId,
            path: doc.path.replace(".sy", ""),
        };
        try {
            let docs: sy_kernel.api.filetree.listDocsByPath.IResponse = await client.listDocsByPath(payload);
            for (let docFile of docs.data.files) {
                this.plugin.checkInterrupt();
                let curChildDoc: Block = await getBlockByID(docFile.id);
                this.plugin.updateProgress("文档块: " + curChildDoc.id + ", " + curChildDoc.hpath);
                await this.getAllBlocksOfDoc(curChildDoc, blocks);
            }
        } catch (e) {
            // 此文档不存在子文档
        }

        let childBlocks: Block[] = [];
        await this.docContentProcessor.getChildBlocksOfBlock(doc, childBlocks);
        for (let curChildBlock of childBlocks) {
            this.plugin.checkInterrupt();
            blocks[doc.id].push(curChildBlock);
        }
    }

    private async generateMarkdownFiles(blocks: {[key:string]:Block[]}): Promise<void> {
        this.plugin.checkInterrupt();
        let siyuan2MkDocsDir: string = this.plugin.pluginWorkDir; 
        let docCnt: number = Object.keys(blocks).length;
        let processedDocCnt: number = 0;
        for (const key in blocks) {
            this.plugin.checkInterrupt();
            if (!blocks.hasOwnProperty(key)) {
                continue;
            }
            let curDoc: Block = undefined;
            let newContent: string = "";
            for (let curBlock of blocks[key]) {
                this.plugin.checkInterrupt();
                if (curBlock.type === "d") {// 每个数组的首个元素为文档块对象
                    curDoc = curBlock;
                    this.plugin.updateProgress("处理文档内容(Kramdown格式), " + curBlock.id + ", " + curBlock.hpath + " ...");
                    newContent = await this.processContentOfDoc(curBlock);
                } else {
                    if (curDoc === undefined || curDoc === null) {
                        return;
                    }

                    this.plugin.updateProgress("处理文档对外链接, " + curBlock.id + ", " + curBlock.hpath + " ...");
                    newContent = await this.docContentProcessor.processSiYuanLinksTo(newContent, curBlock);
                    this.plugin.updateProgress("处理文档对外引用, " + curBlock.id + ", " + curBlock.hpath + " ...");
                    newContent = await this.docContentProcessor.processSiYuanRefsTo(newContent, curBlock);
                }
            }

            let blob: Blob = new Blob([newContent], {
                type : 'application/octet-stream' 
            });
            if (blob === null) {
                console.log("error: blob is null");
                return;
            }
            try {
                let path: string = ""; 
                if (this.plugin.curRootDoc.content === curDoc.content) {
                    path = siyuan2MkDocsDir + this.plugin.curRootDoc.content + "/docs/index.md";
                } else {
                    let rHpath: string = this.mkdocsProcessor.convToRelativeHpathOfRootDoc(this.plugin.curRootDoc, curDoc.hpath);
                    path = siyuan2MkDocsDir + this.plugin.curRootDoc.content + "/docs" + rHpath + ".md";
                }
                await putFile(path, false, blob);
                processedDocCnt++;
                this.plugin.updateProgress("["+processedDocCnt+"/"+docCnt+"] " + path);
            } catch (err) {
                console.log(err);
                return;
            }
        }
    }

    public async generateWebsite(): Promise<void> {
        this.plugin.checkInterrupt();
        this.plugin.updateProgress("获取所有块对象 ...");
        await this.getAllBlocksOfDoc(this.plugin.curRootDoc, this.plugin.allBlocksOfRootDoc);

        let totalBlocksCnt: number = this.plugin.calTotalCntOfBlocks();
        this.plugin.updateProgress("块对象总数: " + totalBlocksCnt);

        // 总执行步数不可知, 但根据实际测试, 总步数差不多是总块数的n倍;
        // 按此倍数处理, 执行完整个流程, 进度条会停留在80%~90%之间, 不合适的话可通过修改n的值来调整;
        let n: number = 5;
        this.plugin.progressDialog.setProgressTotalStepCnt(totalBlocksCnt * n);

        if (this.plugin.curRootDoc === undefined || this.plugin.curRootDoc === null) {
            this.plugin.progressDialog.showErrMsg("error: cur root doc object undefine");
            return;
        }
        let logStr: string = "根文档id: " + this.plugin.curRootDoc.id;
        this.plugin.updateProgress(logStr);

        logStr = "根文档标题: " + this.plugin.curRootDoc.content;
        this.plugin.updateProgress(logStr);

        this.plugin.updateProgress("开始生成网站 ...");

        this.plugin.updateProgress("清理历史网站目录 ...");
        this.delOldWebsiteDir();

        this.plugin.updateProgress("生成mkdocs.yml文件 ...");
        await this.mkdocsProcessor.generateMkdocsYamlFile(this.plugin.allBlocksOfRootDoc);

        this.plugin.updateProgress("生成markdown文件 ...");
        await this.generateMarkdownFiles(this.plugin.allBlocksOfRootDoc);

        // 处理依赖的assets: 将文档块中引用到的assets文件全部拷贝到插件工作目录下的相应目录下
        /////////////////////////////////////////////////////////////////////
        this.plugin.updateProgress("处理依赖的assets文件 ...");
        for (const key in this.plugin.allBlocksOfRootDoc) {
            this.plugin.checkInterrupt();
            if (!this.plugin.allBlocksOfRootDoc.hasOwnProperty(key)) {
                continue;
            }
            let curDoc: Block = await getBlockByID(key);
            if (curDoc === undefined || curDoc === null) {
                continue;
            }
            if (curDoc.type !== "d") {
                continue;
            }
            let md: IResExportMdContent = await exportMdContent(curDoc.id);
            this.plugin.updateProgress("\""+curDoc.content+"\"" + " - 拷贝依赖的资源文件 ...");
            await this.mkdocsProcessor.copyDepAssets(md.content, curDoc.hpath);
        }
        // 单独拷贝网站logo和favicon文件
        this.plugin.updateProgress("拷贝logo文件 ...");
        await this.mkdocsProcessor.copyAssetFile(this.plugin.websiteLogoFileName);
        this.plugin.updateProgress("拷贝favicon文件 ...");
        await this.mkdocsProcessor.copyAssetFile(this.plugin.websiteIconFileName);
        // 调用Mkdocs构建网站
        this.mkdocsBuildAsync();
    } 

    private mkdocsBuildAsync(): void {
        this.plugin.checkInterrupt();
        let commandExecutor: CommandExecutor = new CommandExecutor();
        this.plugin.cmdExecutors.push(commandExecutor);
        commandExecutor.on("output", (output: string) => {
            this.plugin.checkInterrupt();
            this.plugin.stopFakeUpdateProgress();
            if (output.indexOf("Error: ") >= 0) {
                console.error(output);
                this.plugin.progressDialog.showErrMsg(output);
            } else {
                console.log(output);
                this.plugin.updateProgress(output);
            }
        });
        commandExecutor.on("exit", (code: number) => {
            this.plugin.checkInterrupt();
            this.plugin.stopFakeUpdateProgress();
            if (code === 0) {
                this.onGenerateWebsiteSuccess(); 
            } else if (code > 0) {
            } else if (code === null) {
            }
        });
        commandExecutor.on("error", (error: string) => {
            this.plugin.stopFakeUpdateProgress();
        });

        let activateVenvCmd: string = this.plugin.absolutePythonVenvDir + "Scripts\\activate";
        // mkdocs build会把非error信息输出到标准错误, 为方便处理把标准错误重定向到标准输出统一处理;
        let cmd: string = activateVenvCmd + " && cd " + this.plugin.absolutePluginWorkDir 
            + this.plugin.curRootDoc.content + " && mkdocs build --clean --verbose 2>&1";
        commandExecutor.execute(cmd);
        this.plugin.startFakeUpdateProgress();
    }

    private onGenerateWebsiteSuccess(): void {
        this.plugin.checkInterrupt();
        this.plugin.progressDialog.setCancelBtnText("关闭");
        this.plugin.updateProgress("网站已成功生成: " + this.plugin.absoluteGenWebsiteDir);
        this.plugin.progressDialog.setProgress(Number(this.plugin.progressDialog.getProgressMax()));
        if (this.plugin.isAlwaysOpenWebsiteDir) {
            this.openWebsiteDir();
        }
    }

    private openWebsiteDir(): void {
        this.plugin.checkInterrupt();
        let directoryPath: string = this.plugin.absoluteGenWebsiteDir;
        try {
            execSync(`explorer ${directoryPath}`);
            console.log('Directory opened successfully.');
        } catch (err) {
            // console.error('Error opening directory:', err);
        }
    }

    private plugin: NoteToWebsitePlugin;
    private mkdocsProcessor: MkdocsProcessor;
    private docContentProcessor: DocContentProcessor;
};