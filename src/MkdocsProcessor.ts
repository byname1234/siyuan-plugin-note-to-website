import yaml from 'js-yaml';
import containsChinese from "contains-chinese";
import cnc from 'chinese-numbers-converter';
import { getBlockByID, putFile } from "./api";
import { IBlob } from "@siyuan-community/siyuan-sdk";
import * as sy_kernel from '@siyuan-community/siyuan-sdk/src/types/kernel';
import NoteToWebsitePlugin from "./index";

class TreeNode {
    constructor(name: string) {
        this._name = name;
        this._children = {};
    }

    public get name(): string {
        return this._name;
    }

    public get params(): string[] {
        return this._params;
    }

    public set params(value: string[]) {
        this._params = value;
    }

    public get children(): any {
        return this._children;
    }

    private _name: string;
    private _params: string[];
    private _children: { [name: string]: TreeNode };
};

export class MkdocsProcessor {
    public init(plugin: NoteToWebsitePlugin): boolean {
        if (plugin === undefined || plugin === null) {
            return false;
        }
        this.plugin = plugin;
        this.curRootDoc = this.plugin.curRootDoc; 
        return true;
    }

    /**
     * 生成MkDocs所必需的mkdocs.yml文件
     * 
     * @async
     * @param {[key: string]: Block[]} blocks - 块对象表, 以文档块id为key, 文档块中的子块对象数组为value; 
     * @returns {Promise<void>}
     */
    public async generateMkdocsYamlFile(blocks: {[key:string]:Block[]}): Promise<void> {
        this.plugin.checkInterrupt();
        let siyuan2MkDocsDir: string = this.plugin.pluginWorkDir;
        let siteName: string = this.plugin.websiteName;
        let copyright: string = this.plugin.websiteFooter;
        const dat = {
            site_name: siteName, 
            use_directory_urls: false,
            theme: {
                name: "material",
                logo: "assets/"+this.plugin.websiteLogoFileName,
                favicon: "assets/"+this.plugin.websiteIconFileName,
                language: "zh",
                font: false,
                features: [ 
                    "navigator.footer",
                    "navigator.top"
                ], 
                palette: {
                    primary: "blue grey",
                    accent: "light blue"
                }
            },
            extra: {
                generator: false
            },
            copyright: copyright,
            extra_css: [],
            plugins: [
                "glightbox"
            ],
            markdown_extensions: [ 
                "attr_list",
                {
                    toc: {
                        permalink: true,
                        separator: "_",
                    }
                },
                "md_in_html",
                {
                    "pymdownx.highlight": {
                        anchor_linenums: true
                    }
                },
                "pymdownx.inlinehilite",
                "pymdownx.snippets",
                "pymdownx.superfences",
                "mdx_truly_sane_lists",
            ],
            nav: []
        };

        let result: any[] = [];
        this.plugin.updateProgress("生成文档目录树 ...");
        let docs: Block[] = [];
        for (const key in blocks) {
            this.plugin.checkInterrupt();
            if (!blocks.hasOwnProperty(key)) {
                continue;
            }
            let curDoc: Block = await getBlockByID(key);
            if (curDoc === undefined || curDoc === null) {
                continue;
            }
            if (curDoc.type !== "d") {
                continue;
            }
            docs.push(curDoc);
        }
        let directoryTree: TreeNode = this.generateDirectoryTree(docs);
        this.traverseDirectoryTree(directoryTree, "  ", result);

        if (result.length > 0) {
            let n = {}
            n["Home"] = "index.md";
            dat.nav.push(n);
            let s = result[0][this.curRootDoc.content];
            if (Array.isArray(s)) {
                if (!(s === undefined || s === null)) {
                    dat.nav = dat.nav.concat(s);
                }
            }
        }

        let yamlDat: string = yaml.dump(dat);
        let blob: Blob = new Blob([yamlDat], {
            type : 'application/octet-stream' 
        });
        if (blob === null) {
            console.log("error: blob is null");
            return;
        }
        try {
            let path: string = siyuan2MkDocsDir + this.curRootDoc.content + "/mkdocs.yml";
            await putFile(path, false, blob);
            this.plugin.updateProgress(path);
        } catch (err) {
            console.log(err);
            return;
        }
    }

    /**
     * 生成目录树结构
     * 
     * @param {Block[]} blocks - 当前文档下的所有Block对象
     * @returns {TreeNode}
     */
    private generateDirectoryTree(blocks: Block[]): TreeNode {
        this.plugin.checkInterrupt();
        let root: TreeNode = new TreeNode('/');
        for (let curBlock of blocks) {
            this.plugin.checkInterrupt();
            if (curBlock.type === "d") {
                let params: any[] = [];
                let rHpath: string = this.convToRelativeHpathOfRootDoc(this.curRootDoc, curBlock.hpath);
                params.push(rHpath);
                this.plugin.updateProgress(rHpath);
                this.addPathToTree(root, rHpath, params);
            }
        }
        return root;
    }
    
    /**
     * 遍历目录树并输出结果
     * 
     * @param {TreeNode} node - 当前目录节点
     * @param {string} indent - 打印目录树结构时, 目录前的缩进量 
     * @param {any[]} result - 结果数组 
     * @returns {void}
     */
    private traverseDirectoryTree(node: TreeNode, indent: string = '', result: any[]): void {
        this.plugin.checkInterrupt();
        const sortedChildren = Object.values(node.children).sort((a, b) => {
            let numA: string[] = this.parseChapterNum((a as TreeNode).name);
            let numB: string[] = this.parseChapterNum((b as TreeNode).name);
            let len: number = Math.min(numA.length, numB.length);
            let i: number = 0;
            let ret: number = 0;
            for (; i < len; i++) {
                this.plugin.checkInterrupt();
                let curA: number = parseInt(numA[i]);
                let curB: number = parseInt(numB[i]);
                if (curA == curB) {
                    continue;
                } else {
                    ret = curA - curB;
                    break;
                }
            }
            if (i == len) {
                if (numA.length == numB.length) {
                    // 二者完全相等，假设A>B
                    ret = 1;
                } else if (numA.length > numB.length) {
                    // 谁长谁大，所以A大
                    ret = 1;
                } else {
                    ret = -1;
                }
            }
            return ret;
        });

        if (node.name !== "/") {
            console.log(indent + node.name);
            let n = {};
            if (sortedChildren.length > 0) {
                n[node.name] = [];
                result.push(n); 
                result = n[node.name];
            } else {
                n[node.name] = (node.params[0]+".md").substring(1);
                result.push(n);
            }
        }

        for (let childNode of sortedChildren) {
            this.plugin.checkInterrupt();
            this.plugin.updateProgress(result[(childNode as TreeNode).name]);
            this.traverseDirectoryTree(childNode as TreeNode, indent + '  ', result);
        }
    }

    private parseChapterNum(chapter: string): string[] {
        this.plugin.checkInterrupt();
        let num: any[] = [];
        chapter = chapter.replace(/^\s*/g, ''); // 删除起始处的空格
        if (chapter.length > 0) {
            // 中文序号
            if (containsChinese(chapter[0]) === true) {
                let m: RegExpMatchArray = chapter.match(/^[一二三四五六七八九十壹贰叁肆伍陆柒捌玖拾]+/g);
                if (m) {
                    num.push(new cnc(m[0]).toArabicString());
                } else {
                    // 以非中文数字字符开头
                    num = [];
                }
            } else {
                let m: RegExpMatchArray = chapter.match(/^\d[^a-zA-z\s]+/g);
                if (m) {
                    // 去除最后一个数字后面的非数字字符
                    let s: string[] = m[0].split(/(?!.*\d).*$/g);
                    if (s.length > 0) {
                        let s2: string[] = s[0].split(/\D/g);
                        if (s2.length > 0) {
                            num = s2;
                        }
                    }
                } else {
                    // 以非阿拉伯数字开头
                    num = [];
                }
            }
        }
        return num;
    }

    /**
     * 以当前选中的根文档为基准, 将给定块的hpath转换为相对hpath;
     * 
     * @param {Block} rootDoc - 根文档对象
     * @param {string} blockHpath - hpath
     * @returns {string} 处理后的hpath
     * @example
     * 例如: 当前块的hpath为"/A/B/C/D", 根文档名字(content)为C, 则转换后的相对hpath为"/C/D";
     */
    public convToRelativeHpathOfRootDoc(rootDoc: Block, blockHpath: string): string {
        this.plugin.checkInterrupt();
        let newHpath: string = ""; 
        if (rootDoc === undefined || rootDoc === null) {
            return newHpath;
        }
        if (blockHpath === undefined || blockHpath === null) {
            return newHpath;
        }
        let s: string[] = blockHpath.split("/");
        let flag: boolean = false;
        for (let item of s) {
            if (item === "") {
                continue;
            }
            if (item === rootDoc.content) {
                flag = true;
            }
            if (flag) {
                newHpath = newHpath + "/" + item;
            }
        }
        return newHpath;
    }

    /**
     * 添加文件路径到目录树
     * 
     * @param {TreeNode} root - 目录树根节点
     * @param {string} path - 待添加的路径
     * @param {string[]} params
     * @returns {void}
     */
    private addPathToTree(root: TreeNode, path: string, params: string[]): void {
        this.plugin.checkInterrupt();
        let currentNode: TreeNode = root;
        let segments: string[] = path.split("/");
        for (let segment of segments) {
            this.plugin.checkInterrupt();
            if (segment !== "") {
                if (!currentNode.children[segment]) {
                    currentNode.children[segment] = new TreeNode(segment);
                    currentNode.children[segment].params = params;
                }
                currentNode = currentNode.children[segment];
            }
        }
    }

    public async copyFile(srcFilePath: string, dstFilePath: string): Promise<void> {
        this.plugin.checkInterrupt();
        try {
            const getPayload: sy_kernel.api.file.getFile.IPayload = {
                path: srcFilePath
            };
            let blob: IBlob = await this.plugin.getFile(getPayload); 
            const putPayload: sy_kernel.api.file.putFile.IPayload = {
                path: dstFilePath,
                file: blob,
                isDir: false,
                modTime: 0,
            }
            await this.plugin.putFile(putPayload); 
        } catch (e) {
            console.log(e);
        }
    }

    /**
     * 拷贝此文档内容依赖的所有assets文件到插件工作目录下的对应目录
     * 
     * @async
     * @param {string} mdContent - Markdown内容 
     * @param {string} hpath
     * @returns {Promise<void>}
     */
    public async copyDepAssets(mdContent: string, hpath: string = ""): Promise<void> {
        this.plugin.checkInterrupt();
        //
        // 例如mdContent为:
        //
        // "# 本地资源：图片
        //
        // ​![690cbd8ac2be9497dc86a125d7179ff7](assets/690cbd8ac2be9497dc86a125d7179ff7-20240527233809-7w4i7o2.jpeg)​
        // "
        //
        let regex: RegExp = new RegExp('\\[.*assets.*\\)', 'g');
        let ret: RegExpMatchArray = mdContent.match(regex);
        let processedAssetCnt: number = 0;
        if (ret !== null) {
            for (let item of ret) {
                this.plugin.checkInterrupt();
                let path: string = item.split("](")[1];
                if (path === undefined) {
                    continue;
                }
                let rPath: string = path.slice(0, path.length-1);
                path = "data/" + rPath;

                let hpath2: string = hpath;
                if (hpath.length !== 0) {
                    hpath2 = hpath.substring(0, hpath.lastIndexOf("/"));
                }
                hpath2 = this.convToRelativeHpathOfRootDoc(this.curRootDoc, hpath2);
                let dstPath: string = this.plugin.pluginWorkDir + this.curRootDoc.content + "/docs" + hpath2 + "/" + rPath;

                await this.copyFile(path, dstPath);
                processedAssetCnt++;
                this.plugin.updateProgress("["+processedAssetCnt+"/"+ret.length+"] Copy " + path + " to " + dstPath);
            }
        }

        //
        // mdContent还可能为:
        //
        // "# 本地资源：视频（不支持）
        //
        // <video controls="controls" src="assets/1.mp4" data-src="assets/1.mp4"></video>
        // "
        //
        regex = new RegExp('src=.*assets.*\\"\\s', 'g');
        ret = mdContent.match(regex);
        processedAssetCnt = 0;
        if (ret !== null) {
            for (let item of ret) {
                this.plugin.checkInterrupt();
                let path: string = item.split("src=\"")[1];
                if (path === undefined) {
                    continue;
                }
                let rPath: string = path.slice(0, path.length-2);
                path = "data/" + rPath;

                let hpath2: string = hpath;
                if (hpath.length !== 0) {
                    hpath2 = hpath.substring(0, hpath.lastIndexOf("/"));
                }
                hpath2 = this.convToRelativeHpathOfRootDoc(this.curRootDoc, hpath2);
                let dstPath: string = this.plugin.pluginWorkDir + this.curRootDoc.content + "/docs" + hpath2 + "/" + rPath;

                await this.copyFile(path, dstPath);
                processedAssetCnt++;
                this.plugin.updateProgress("["+processedAssetCnt+"/"+ret.length+"] Copy " + path + " to " + dstPath);
            }
        }
    }

    public async copyAssetFile(fileName: string): Promise<void> {
        this.plugin.checkInterrupt();
        if (fileName === undefined || fileName === null) {
            return;
        }
        let fileName2: string = fileName.trim();
        let srcPath: string = "data/assets/" + fileName2; 
        let dstPath: string = "";
        dstPath = this.plugin.pluginWorkDir + this.curRootDoc.content + "/docs/assets/" + fileName2;
        this.plugin.updateProgress("Copy " + srcPath + " to " + dstPath);
        await this.copyFile(srcPath, dstPath);
        return;
    }

    private plugin: NoteToWebsitePlugin;
    private curRootDoc: Block; 
};