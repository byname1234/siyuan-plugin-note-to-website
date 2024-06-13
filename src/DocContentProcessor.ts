import { getBlockByID, getBlockKramdown, getChildBlocks } from "./api";
import NoteToWebsitePlugin from "./index";

export class DocContentProcessor {
    public init(plugin: NoteToWebsitePlugin): boolean {
        if (plugin === undefined || plugin === null) {
            return false;
        }
        this.plugin = plugin;
        this.docOriginFullContent = ""; this.docNewFullContent = "";
        this.indentsAdjustLinesRecordDict = new Map();
        return true;
    }

    public async doProcess(doc: Block): Promise<string> {
        if (doc === undefined || doc === null) {
            return "";
        }
        this.docOriginFullContent = await this.getBlockKramdownEx(doc);
        if (this.docOriginFullContent === "") {
            return "";
        }
        this.docNewFullContent = this.docOriginFullContent;

        let topLevelChildBlocks: Block[] = await this.getTopLevelChildBlocksOfDoc(doc);
        topLevelChildBlocks = this.sortTopLevelBlocksOfSingleDoc(topLevelChildBlocks, this.docOriginFullContent);
        for (let curTopLevelChildBlock of topLevelChildBlocks) {
            this.plugin.checkInterrupt();
            if (curTopLevelChildBlock === undefined || curTopLevelChildBlock === null) {
                continue;
            }
            await this.processBlockContentOfDoc(curTopLevelChildBlock, doc);
        }

        // 文档内容的最后一行为此文档的ial, 将其删除;
        let docIal: string = this.standardizeKramdown(doc.ial);
        this.docNewFullContent = this.delLinesContainedStr(this.docNewFullContent, docIal);

        // 将剩余的ial全部原地转为HTML锚点标记
        this.docNewFullContent = this.replaceToHtmlAnchorInOriginPos(this.docNewFullContent);

        // 按照笔记中图片的属性值, 转成HTML后图片会非常大, 这里要对图片属性
        // 值做调整, 以保证HTML中的图片与笔记中的图片大小基本一致;
        let parsedImageIALs: any[] = this.parseImageIAL(this.docNewFullContent);
        if (!(parsedImageIALs === undefined || parsedImageIALs === null)) {
            for (let curIAL of parsedImageIALs) {
                this.plugin.checkInterrupt();
                let newIAL: string = this.customizeImageIAL(curIAL["parent-style-width"]);
                this.docNewFullContent = this.docNewFullContent.replace(curIAL["ial"], newIAL);
                this.plugin.updateProgress("调整图片尺寸: " + curIAL["ial"] + " -> " + newIAL);
                console.log("调整图片尺寸: " + curIAL["ial"] + " -> " + newIAL);
            }
        }
        return this.docNewFullContent;
    } 

    /**
     * 解析内容中包含的图片所对应的内嵌属性列表(IAL)
     * 
     * @param {string} kdContent - Kramdown内容
     * @returns {any[]} 结果数组
     * @example
     * 从​![1,100000152](assets/1,100000152-20240408173522-o1yxfyl.png){: style="width: 10000px;" parent-style="width: 21%;"}​
     * {: id="20240408173522-uv6lw4f" updated="20240425102854"}中解析出{: style="width: 10000px;" parent-style="width: 21%;"}​
     * 
     * 对于从未在思源笔记中调整过缩放比例的图片, 不存在内嵌属性列表, 例如: 
     * ​![3,100000187](assets/3,100000187-20240408185725-njuzox0.png)​
     * {: id="20240430003812-pwn7a19" updated="20240430004205"}
     */ 
    private parseImageIAL(kdContent: string): any[] {
        this.plugin.checkInterrupt();
        if (kdContent === undefined || kdContent === null) {
            return [];
        }
        let match: RegExpMatchArray = kdContent.match(/{: .*style=.*parent-style=.*}|{: .*parent-style=.*style=.*}/g); 
        if (match === undefined || match === null) {
            return [];
        }
        let results: any[] = [];
        for (let curMatch of match) {
            this.plugin.checkInterrupt();
            let result = {};
            let match2: RegExpExecArray = (/{:.*parent-style="width:\s([^"]+);".*}/g).exec(curMatch);
            if (match2 === undefined || match2 === null) {
                continue;
            }
            let match3: RegExpExecArray = (/{:.* style="width:\s([^"]+);".*}/g).exec(match2[0]);
            if (match3 === undefined || match2 === null) {
                continue;
            }
            result["ial"] = match2[0];
            result["parent-style-width"] = match2[1];
            result["style-width"] = match3[1];
            results.push(result);
        }
        return results;
    }

    private customizeImageIAL(originalStyleWidth: string): string {
        this.plugin.checkInterrupt();
        if (originalStyleWidth === undefined || originalStyleWidth === null 
            || originalStyleWidth.length === 0) {
            return "";
        }

        let newIAL: string = "";
        // 若原始宽度为百分比形式, 只有在思源笔记中调整过缩放比例的图片才带有此标记;
        if (originalStyleWidth.indexOf("%") >= 0) {
            let width: string = originalStyleWidth.replace("%", "");
            let newWidth: number = Number(width) + Number(this.plugin.websiteImgAdjustParam);
            newIAL = "{: style=\"width: " + newWidth + "%;\"}";
        }
        return newIAL;
    } 

    /**
     * 将行内存在的IAL标记全部原地替换为HTML锚点标记
     * 
     * @param {string} kdContent - Kramdown内容
     * @returns {string} 处理后的内容
     */ 
    private replaceToHtmlAnchorInOriginPos(kdContent: string): string {
        this.plugin.checkInterrupt();
        if (kdContent === undefined || kdContent === null) {
            return kdContent;
        }
        let content2: string = kdContent;
        let lines: string[] = kdContent.split("\n");
        for (let line of lines) {
            this.plugin.checkInterrupt();
            let results: any[] = this.parseIALs(line, "just-replace");
            for (let r of results) {
                this.plugin.checkInterrupt();
                content2 = content2.replace(r["ial"], r["htmlanchortag"]);
            }
        }
        return content2;
    }

    private async getBlockKramdownEx(block: Block): Promise<string> {
        this.plugin.checkInterrupt();
        if (block === undefined || block === null) {
            return "";
        }
        let kd: IResGetBlockKramdown = await getBlockKramdown(block.id);
        if (kd === undefined || kd === null) {
            return "";
        }
        return this.standardizeKramdown(kd.kramdown);
    }

    /**
     * 对Kramdown进行标准化处理, 这里定义的标准格式为 {: id="xxxx" updated="yyyy"}
     * 
     * @param {string} kdContent - Kramdown内容
     * @returns {string} 处理后的内容
     */
    private standardizeKramdown(kdContent: string): string {
        this.plugin.checkInterrupt();
        //
        // 在原始的Kramdown内容中, id和updated的先后顺序不是一致的, 例如: 
        // {: id="20240418133836-zzzd0pt" updated="20240418133843"}
        // * {: updated="20240418133844" id="20240418133840-m2jpr28"}AA-2
        //
        // 有的标记中存在除id和updated的其他字段, 例如:
        // {: id="20240412211810-c5h0la7" title="xx" type="doc" updated="20240413201129"}
        //
        // 有的标记只存在id字段, 例如:
        // * {: id="20240418133833-htrydmb"}BB
        //
        // 以上情况会令内容替换无法实施, 这里把标记中的内容一律改为id在前, updated在后(不存在updated的置空), 
        // 且忽略除id和updated字段外的所有字段;
        //
        // 即: Kramdown标记会被统一格式化为 {: id="xxxx" updated="yyyy"} 的形式, 若原标记中不存在updated字段, 这里的updated="";
        //
        if (kdContent === undefined || kdContent === null || kdContent.length === 0) {
            return kdContent;
        }

        let newKd: string = "";
        let kdLines: string[] = kdContent.split("\n");
        for (let line of kdLines) {
            this.plugin.checkInterrupt();
            let newLine: string = line;
            let match: RegExpExecArray = (/{:.*id="([^"]+)".*}/g).exec(line);
            if (!(match === null || match === undefined)) {
                let id: string = match[1];
                let updated: string = "";
                let match2: RegExpExecArray = (/{:.*updated="([^"]+)".*}/g).exec(line);
                if (!(match2 === null || match2 === undefined)) {
                    updated = match2[1];
                } else {
                    updated = ""; // updated有可能不存在
                }

                let newTag: string = "{: id=" + "\"" + id + "\"" + " " + "updated=" + "\"" + updated + "\"}";
                newLine = line.replace(/{:.*}/g, newTag);
            }

            newKd = newKd + newLine + "\n"; 
        }

        // 去掉末尾的换行符
        if (newKd.length > 0) {
            newKd = newKd.substring(0, newKd.length-1);
        }
        return newKd;
    }

    /**
     * 获取此文档下的一级子块;
     * 注意: 查询结果是无序的, 不保证能与笔记中各块顺序一致;
     * 
     * @async
     * @param {Block} doc - 文档对象
     * @returns {Promise<Block[]>} 所有一级子块对象的数组 
     */
    private async getTopLevelChildBlocksOfDoc(doc: Block): Promise<Block[]> {
        this.plugin.checkInterrupt();
        if (doc === undefined || doc === null) {
            return [];
        }
        if (!("type" in doc && "id" in doc)) {
            return [];
        }
        if (doc.type !== "d") {
            return [];
        }
        let blocks: Block[] = [];
        await this.getTopLevelChildBlocksOfBlock(doc, blocks);
        return blocks;
    }

    /**
     * 获取此块下的全部一级子块;
     * 
     * @async
     * @param {Block} block - 当前块对象
     * @param {Block[]} blocks - 所有一级子块对象的数组 
     * @returns {Promise<void>}
     * @example
     * 例如, 下面的文档块中包含两个块, 一级子块为"## HEAD", XXXX也是子块, 
     * 但它是"## HEAD"的子块, 是此文档块的二级子块; 
     *
     * ## HEAD
     * XXXX
     */
    public async getTopLevelChildBlocksOfBlock(block: Block, blocks: Block[]): Promise<void> {
        this.plugin.checkInterrupt();
        if (block === undefined || block === null) {
            return;
        }
        let ret: IResGetChildBlock[] = await getChildBlocks(block.id);
        for (let item of ret) {
            let curChildBlock: Block = await getBlockByID(item.id);
            // getChildBlocks函数会把HEAD下的第一级子块也取出来, 需要基于parent_id过滤掉;
            if (block.id === curChildBlock.parent_id) {
                blocks.push(curChildBlock);
                this.plugin.updateProgress("块: " + curChildBlock.id + ", " + curChildBlock.hpath);
            }
        }
    }

    public async getChildBlocksOfBlock(block: Block, blocks: Block[]): Promise<void> {
        this.plugin.checkInterrupt();
        if (block === undefined || block === null) {
            return;
        }
        let ret: IResGetChildBlock[] = await getChildBlocks(block.id);
        for (let item of ret) {
            let curChildBlock: Block = await getBlockByID(item.id);
            blocks.push(curChildBlock);
            this.plugin.updateProgress("块: " + curChildBlock.id + ", " + curChildBlock.hpath);
        }
    }

    private sortTopLevelBlocksOfSingleDoc(blocks: Block[], docKramdown: string): any {
        this.plugin.checkInterrupt();
        if (blocks === undefined || blocks === null) {
            return [];
        }
        if (docKramdown === undefined || docKramdown === null 
            || docKramdown.length === 0) {
            return [];
        }

        let sorted: any[] = [];
        let lines = docKramdown.split("\n");
        for (let i = 0; i < lines.length; i++) {
            this.plugin.checkInterrupt();
            let curLine: string = lines[i];
            for (let j = 0; j < blocks.length; j++) {
                this.plugin.checkInterrupt();
                let curBlock: Block = blocks[j];
                let keyStr: string = "{: id=\"" + curBlock.id + "\"";
                if (curLine.indexOf(keyStr) >= 0) {
                    sorted.push(curBlock);
                    break;
                }
            }
        }
        return sorted;
    }

    private async processBlockContentOfDoc(block: Block, doc: Block): Promise<void> {
        this.plugin.checkInterrupt();
        await this.processBlockContentOfDoc_(block, doc);
    }

    private async processBlockContentOfDoc_(block: Block, doc: Block): Promise<void> {
        this.plugin.checkInterrupt();
        if (block === undefined || block === null) {
            return;
        }

        switch (block.type) {
            case "p": 
                {
                    // 段落块
                    //
                    // 在处理其他类型的块的过程中, 很可能又会遇到段落子块, 从而到这里来处理; 
                    //
                    // type为"p"的块还有:
                    // 行级代码块, subtype为空;
                    //
                    //
                    // 不论哪种类型的块, 其内容都可视为段落块, 也就是说大多数块都会含有段落块
                    // 或其自身就是段落块, 比如:
                    //
                    // 一个自然段: 
                    // xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                    // xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                    //
                    // 列表中的每行实际内容:
                    // * A
                    //   * A-1
                    // * B
                    // *
                    // * C
                    //   
                    // * D
                    // 其中, *号为列表块特有的形式, 而*后的内容则为段落块, 段落块用于承载实际内容, 不含有某个特定块的特有格式符;
                    // 因此, "* B"与"* C"两行之间的"*"行, 和"* C"与"* D"之间的段落块的Kramdown去掉ial后都是空的, 在段落块处理
                    // 逻辑中是无法区分的!
                    //
                    await this.processParagraphBlock(block);
                    break;
                }
            case "h": 
                {
                    // 标题块
                    //
                    // 标题块会把其下方的块纳为子块
                    //

                    await this.processHeaderBlock(block);
                    break;
                }
            case "l":
                {
                    // 列表块
                    //
                    // 列表整体, 列表条目属于i类型块
                    //

                    await this.processListBlock(block, doc);
                    break;
                }
            case "i":
                {
                    // 列表条目块
                    //
                    // 条目内的具体内容属于段落块

                    // 列表条目就是列表块的实际内容(带列表格式符), 例如列表:
                    // 
                    // * A
                    //   * A-1
                    // * B
                    // *
                    // * C
                    //   
                    // * D
                    //
                    // 其中, 整个内容
                    // * A
                    //   * A-1
                    // * B
                    // *
                    // * C
                    //   
                    // * D
                    // 
                    // 以及每一行, 如: "* A", "* A-1" ..., 等都是列表item; 
                    // 而, 每个item内的不带格式的内容则为段落块, 例如: "* A"中的A就由段落块来承载;
                    //
                    // 特别注意, C, D之间不带*的空内容, 会被视为"* C"的一部分, "* C"对应块的Kramdown为:
                    //
                    // * {: id="20240526013026-50wbh6n" updated="20240526125221"}C
                    //   {: id="20240526013026-zlvw1pc" updated="20240526013027"}
                    //
                    //   {: id="20240526013637-d6384ue" updated="20240526125221"}
                    //
                    // id为20240526013637-d6384ue的ial即为对此空行的描述, 此块的类型为"p", 即段落块;
                    //

                    // await this.processListItemBlock(block);
                    break;
                }
            case "d":
                {
                    break;
                }
            case "s":
                {
                    break;
                }
            case "b":
                {
                    // 引述块, blockquote
                    await this.processBlockquoteBlock(block);
                    break;
                }
            case "html":
                {
                    // html块
                    await this.processHtmlBlock(block);
                    break;
                }
            case "iframe":
                {
                    await this.processIFrameBlock(block);
                    break;
                }
            case "t":
                {
                    await this.processTableBlock(block);
                    break;
                } 
            case "c":
                {
                    await this.processCodeBlock(block);
                    break;
                } 
            case "f":
                {
                    break;
                }
            case "audio":
                {
                    await this.processAudioBlock(block);
                    break;
                }
            case "video":
                {
                    await this.processVideoBlock(block);
                    break;
                }
            case "other":
                {
                    break;
                }
            default:
                {
                    break;
                }
        } 

        let childBlocks: IResGetChildBlock[] = await getChildBlocks(block.id);
        for (let item of childBlocks) {
            let curChildBlock: Block = await getBlockByID(item.id); 
            await this.processBlockContentOfDoc_(curChildBlock, doc);
        }
    }

    private async getBlockContentStartPosInDoc(block: Block, docContent: string): Promise<number> {
        if (block === undefined || block === null) {
            return -1;
        }
        if (docContent === undefined 
            || docContent === null || docContent === "") {
        }

        let blockKd: string = await this.getBlockKramdownEx(block);
        if (blockKd === undefined
            || blockKd === null || blockKd === "") {
            return -1;
        }

        // 块对象的Kramdown内容自带的缩进量与其在整个文档Kramdown内容中的缩进量不同:
        //
        // * {: id="20240516185451-qdrq2bt" updated="20240516185457"}AA-1
        //   {: id="20240516185451-frotmdu" updated="20240516185457"}
        // {: id="20240516185453-zr08rcl" updated="20240516185457"}
        //
        // 而此内容在文档中的缩进量为:
        //
        // * {: id="20240514233742-luuiga8" updated="20240516185457"}AA
        //   {: id="20240514233742-3zantb7" updated="20240514233742"}
        //
        //   * {: id="20240516185451-qdrq2bt" updated="20240516185457"}AA-1
        //     {: id="20240516185451-frotmdu" updated="20240516185457"}
        //   {: id="20240516185453-zr08rcl" updated="20240516185457"}
        // * {: id="20240516203411-imlpbxr" updated="20240516203414"}BB
        //   {: id="20240516203411-ygvm553" updated="20240516203414"}
        // {: id="20240514214356-k3f05cy" updated="20240516203414"}
        //

        let blockKdLines: string[] = blockKd.split("\n");
        if (blockKdLines.length === 0) {
            return -1;
        }
        let lastLine: string = blockKdLines[blockKdLines.length-1];
        let startPos: number = docContent.indexOf(lastLine);
        if (startPos < 0) {
            return -1;
        }

        // 例如:
        //
        // aaaa
        // {: id="20240526174107-0bmsmbb" updated="20240526174107"}
        //
        // 在下面这个文档中的缩进为:
        //
        // * {: id="20240526174107-01eeqkb" updated="20240526174107"}aaaa
        //   {: id="20240526174107-0bmsmbb" updated="20240526174107"}
        // 
        // {: id="20240526002034-hughthl" updated="20240526174107"}"
        //
        let indents: string = this.getFirstLineWithStrIndentsAsInDoc(lastLine);
        let targetStr: string = "";
        for (let i = 0; i < blockKdLines.length-1; i++) {
            let curLine: string = blockKdLines[i];
            if (targetStr === "") {// 首行不加缩进
                targetStr = curLine; 
            } else {
                if (curLine === "") {
                    // 空白行之前不要加缩进
                    targetStr = targetStr + "\n" + curLine; 
                } else {
                    targetStr = targetStr + "\n" + indents + curLine; 
                }
            }
        }
        if (targetStr.length > 0) {
            targetStr += "\n";
        } else {
            targetStr = "\n";
        }

        let pos: number = -1;
        for (let i = startPos-1; i >= 0; i--) {
            let curChar: string = docContent[i]; 
            if (curChar != " ") {// 跳过缩进
                for (let j = targetStr.length-1; j >= 0; j--) {
                    pos = i - (targetStr.length - 1 - j); 
                    if (pos < 0) {
                        pos = -1;
                        break;
                    }
                    curChar = docContent[pos];
                    let curTargetChar: string = targetStr[j];
                    if (curChar === curTargetChar) {
                        continue;
                    }

                    let a = Array.from(targetStr);
                    console.log(a);
                    let b = Array.from(docContent);
                    console.log(b);

                    pos = -1;
                    break;
                }
                break;
            }
        }
        return pos;
    }

    /**
     * 获取字符串所在行在文档的Kramdown内容中的缩进
     * 
     * @param {string} keyStr - 目标字符串
     * @returns {string}
     */
    private getFirstLineWithStrIndentsAsInDoc(keyStr: string): string {
        if (keyStr === undefined || keyStr === null || keyStr === "") {
            return "";
        }
        let indents: string = "";
        let pos: number = this.docOriginFullContent.indexOf(keyStr);
        if (pos >= 0) {
            for (let i = pos-1; i >= 0; i--) {
                let curChar = this.docOriginFullContent[i];
                if (curChar === "\n") {
                    break;
                }
                if (curChar === " ") {
                    indents += curChar;
                }
            }
        } else {
            indents = "";
        }
        return indents;
    }

    private async processParagraphBlock(block: Block): Promise<void> {
        //
        // 对于段落块, 将HTML锚点标记插入到此块的内容之前即可, 例如:
        //
        // 当前文档的内容为:
        // aaaa
        // {: id="20240515170711-6p4868i" updated="20240516135628"}
        //
        // {: id="20240515000332-qz9oa6l" updated="20240516135634"}
        //
        // 若当前块的内容为:
        // aaaa
        // {: id="20240515170711-6p4868i" updated="20240516135628"}
        //
        // 则插入HTML锚点标记后的内容为:
        // <span id="20240515170711-6p4868i-20240516135628"></span>aaaa
        //
        // {: id="20240515000332-qz9oa6l" updated="20240516135634"}
        
        // 当前文档中的列表块:
        //
        // * {: id="20240514233742-luuiga8" updated="20240514233742"}AA
        //   {: id="20240514233742-3zantb7" updated="20240514233742"}
        // {: id="20240514214356-k3f05cy" updated="20240514233742"}
        //
        // {: id="20240514214356-lfmn7mh" updated="20240514233742"}
        //
        // 若当前块(列表块下的段落块)的内容为:
        // AA
        // {: id="20240514233742-3zantb7" updated="20240514233742"}
        //
        // 则插入HTML锚点标记后的内容为:
        // * {: id="20240514233742-luuiga8" updated="20240514233742"}<span id="20240514233742-3zantb7-20240514233742"></span>AA
        // {: id="20240514214356-k3f05cy" updated="20240514233742"}
        //
        // {: id="20240514214356-lfmn7mh" updated="20240514233742"}
        //
        let ial: string = this.standardizeKramdown(block.ial);
        let dataAttr: string = "";
        let parentBlock: Block = await this.getParentBlock(block);
        if (this.isListSeriesBlock(parentBlock)) {// 此块为列表内的段落块
            let match: RegExpMatchArray = block.markdown.match(/.*\[.*\]\(assets.*\).*/g);
            if (match === null) {
                dataAttr = "list-content";
            } else {
                // 列表内容中含有对assets目录下资源文件的使用, 此行上下方应各保留一行空行;
                dataAttr = "list-content-asset";
            }
        }
        let parsedIAL: any[] = this.parseIALs(ial, dataAttr);
        if (parsedIAL.length > 0) {
            let htmlAnchorLine: string = parsedIAL[0].htmlanchortag;
            let insertPos: number = await this.getBlockContentStartPosInDoc(block, this.docNewFullContent);
            if (insertPos < 0) {
                return;
            }
            let insertContent: string = "";
            let isEmptyBlock: boolean = false;
            if (block.markdown === "") {
                // 此块的内容为空
                isEmptyBlock = true;
                if (this.isListSeriesBlock(parentBlock)) {
                    let indents: string = this.getFirstLineWithStrIndentsAsInDoc(ial);
                    insertContent = indents + htmlAnchorLine + "&nbsp;";
                } else {
                    insertContent = "\n" + htmlAnchorLine + "&nbsp;";
                }
            } else {
                insertContent = htmlAnchorLine;
            }
            this.docNewFullContent = this.insertContentBeforePos(this.docNewFullContent, insertPos, insertContent);
            this.docNewFullContent = this.delLinesContainedStr(this.docNewFullContent, ial);
            this.docNewFullContent = this.delBlankLinesBetweenTwoLinesContainedAttr(this.docNewFullContent, "list-content");
            //
            // 含有asset文件的列表行, 其下方需要空出一行方能被渲染为HTML, 例如:
            //
            // * <span id="20240612175324-5u7qa6q-20240408181413" data-attr="just-replace"></span><span id="20240612175324-d37bqpp-20240323161416" data-attr="list-content"></span>AA
            //
            //  <span id="20240612175324-13lfm0g-20240408181413" data-attr="list-content-asset"></span>​![3,100000166](assets/3,100000166-20240408181411-7fzxupi.png)​
            //
            // * <span id="20240612175324-wt06clr-20240612214447" data-attr="just-replace"></span><span id="20240612175324-zpovqsd-20240323161416" data-attr="list-content"></span>BB
            //
            this.docNewFullContent = this.tryAddBlankLineAfterLinesContainedAttr(this.docNewFullContent, "list-content-asset");
            // Block内容对应的Markdown描述字符串中的多个连续空格在渲染为HTML时只会保留一
            // 个, 这里需将空格都转为HTML空格转移字符才能将其全部保留下来;
            /*
            if (!block.markdown.includes("](assets")) {// 资源链接中的空格不要替换
                this.docNewFullContent = this.replaceBlankCharToHtmlEscapeChar(this.docNewFullContent, block.content, block.markdown);
            }
            */
            if (this.isListSeriesBlock(parentBlock)) {
                if (isEmptyBlock) {
                    this.docNewFullContent = this.delBlankLinesUponLineContainedStr(this.docNewFullContent, htmlAnchorLine);
                }
            }

            // 有序列表的格式标识为数字, 数字并非特殊字符, 在插入HTML锚点标记后, 
            // 可能会令Markdown渲染器无法区分有序列表与正文, 经实际测试, 将有序
            // 列表各行的缩进减半, 能确保Markdown渲染引擎正确识别出有序列表;
            if (this.isOrderListSeriesBlock(parentBlock)) {
                this.docNewFullContent = this.havleIndentsOfLineContainedStr(this.docNewFullContent, htmlAnchorLine);
            }
        }
    }

    private async processHeaderBlock(block: Block): Promise<void> {
        
        // ## AAAA
        // {: id="20240526002037-wknixzo" updated="20240526002129"}
        //
        // ### BBBBBB
        // {: id="20240526002130-p8nrmxj" updated="20240526002131"}
        //
        // 转换为
        //
        // ## AAAA<span id="20240526002037-wknixzo-20240526002129"></span>
        //
        // ### BBBBBB<span id="20240526002130-p8nrmxj-20240526002131"></span>
        //

        let ial: string = this.standardizeKramdown(block.ial);
        let parsedIAL: any[] = this.parseIALs(ial);
        if (parsedIAL.length > 0) {
            let htmlAnchorLine: string = parsedIAL[0].htmlanchortag;
            let insertPos: number = this.docNewFullContent.indexOf(ial); 
            insertPos -= 1; // 前面还有一个换行符
            if (insertPos < 0) {
                return;
            }
            let insertContent: string = "";
            if (block.markdown === "") {
                // 此块的内容为空
                insertContent = htmlAnchorLine + "&nbsp;\n";
            } else {
                insertContent = htmlAnchorLine;
            }
            this.docNewFullContent = this.insertContentBeforePos(this.docNewFullContent, insertPos, insertContent);
            this.docNewFullContent = this.delLinesContainedStr(this.docNewFullContent, ial);
        }
    }

    private async processTableBlock(block: Block): Promise<void> {
        let ial: string = this.standardizeKramdown(block.ial);
        let parsedIAL: any[] = this.parseIALs(ial);

        if (parsedIAL.length > 0) {
            let htmlAnchorLine: string = parsedIAL[0].htmlanchortag;
            let insertPos: number = await this.getBlockContentStartPosInDoc(block, this.docNewFullContent);
            if (insertPos < 0) {
                return;
            }
            let indents: string = this.getFirstLineWithStrIndentsAsInDoc(ial); 
            let insertContent: string = "";
            if (block.markdown === "") {
                // 内容为空
                ;
            } else {
                insertContent = indents + htmlAnchorLine + "\n\n";
            }

            this.docNewFullContent = this.insertContentBeforePos(this.docNewFullContent, insertPos, insertContent);
            this.docNewFullContent = this.delLinesContainedStr(this.docNewFullContent, ial);
        }
    }

    private async processHtmlBlock(block: Block): Promise<void> {
        let ial: string = this.standardizeKramdown(block.ial);
        let parsedIAL: any[] = this.parseIALs(ial);
        if (parsedIAL.length > 0) {
            let htmlAnchorLine: string = parsedIAL[0].htmlanchortag;
            let insertPos: number = await this.getBlockContentStartPosInDoc(block, this.docNewFullContent);
            if (insertPos < 0) {
                return;
            }
            let indents: string = this.getFirstLineWithStrIndentsAsInDoc(ial); 
            let insertContent: string = "";
            if (block.markdown === "") {
                // 内容为空
                ;
            } else {
                insertContent = indents + htmlAnchorLine + "\n\n";
            }

            this.docNewFullContent = this.insertContentBeforePos(this.docNewFullContent, insertPos, insertContent);
            this.docNewFullContent = this.delLinesContainedStr(this.docNewFullContent, ial);
        }
    }

    private async processIFrameBlock(block: Block): Promise<void> {
        let ial: string = this.standardizeKramdown(block.ial);
        let parsedIAL: any[] = this.parseIALs(ial);
        if (parsedIAL.length > 0) {
            let htmlAnchorLine: string = parsedIAL[0].htmlanchortag;
            let insertPos: number = await this.getBlockContentStartPosInDoc(block, this.docNewFullContent);
            if (insertPos < 0) {
                return;
            }
            let indents: string = this.getFirstLineWithStrIndentsAsInDoc(ial); 
            let insertContent: string = "";
            if (block.markdown === "") {
                // 内容为空
                ;
            } else {
                insertContent = indents + htmlAnchorLine + "\n\n";
            }

            this.docNewFullContent = this.insertContentBeforePos(this.docNewFullContent, insertPos, insertContent);
            this.docNewFullContent = this.delLinesContainedStr(this.docNewFullContent, ial);
        }
    }

    private async processBlockquoteBlock(block: Block): Promise<void> {
        let ial: string = this.standardizeKramdown(block.ial);
        let parsedIAL: any[] = this.parseIALs(ial);
        if (parsedIAL.length > 0) {
            let htmlAnchorLine: string = parsedIAL[0].htmlanchortag;
            let insertPos: number = await this.getBlockContentStartPosInDoc(block, this.docNewFullContent);
            if (insertPos < 0) {
                return;
            }
            let indents: string = this.getFirstLineWithStrIndentsAsInDoc(ial); 
            let insertContent: string = "";
            if (block.markdown === "") {
                // 内容为空
                ;
            } else {
                insertContent = indents + htmlAnchorLine + "\n\n";
            }

            this.docNewFullContent = this.insertContentBeforePos(this.docNewFullContent, insertPos, insertContent);
            this.docNewFullContent = this.delLinesContainedStr(this.docNewFullContent, ial);
        }
    }

    private async processCodeBlock(block: Block): Promise<void> {
        let ial: string = this.standardizeKramdown(block.ial);
        let parsedIAL: any[] = this.parseIALs(ial);
        if (parsedIAL.length > 0) {
            let htmlAnchorLine: string = parsedIAL[0].htmlanchortag;
            let insertPos: number = await this.getBlockContentStartPosInDoc(block, this.docNewFullContent);
            if (insertPos < 0) {
                return;
            }
            let indents: string = this.getFirstLineWithStrIndentsAsInDoc(ial); 
            let insertContent: string = "";
            if (block.markdown === "") {
                // 内容为空
                ;
            } else {
                // insertContent = indents + htmlAnchorLine + "\n\n";
                insertContent = htmlAnchorLine + "\n\n" + indents;
            }

            this.docNewFullContent = this.insertContentBeforePos(this.docNewFullContent, insertPos, insertContent);
            this.docNewFullContent = this.delLinesContainedStr(this.docNewFullContent, ial);
        }
    }

    private async processAudioBlock(block: Block): Promise<void> {
        let ial: string = this.standardizeKramdown(block.ial);
        let parsedIAL: any[] = this.parseIALs(ial);
        if (parsedIAL.length > 0) {
            let htmlAnchorLine: string = parsedIAL[0].htmlanchortag;
            let insertPos: number = await this.getBlockContentStartPosInDoc(block, this.docNewFullContent);
            if (insertPos < 0) {
                return;
            }
            let indents: string = this.getFirstLineWithStrIndentsAsInDoc(ial); 
            let insertContent: string = "";
            if (block.markdown === "") {
                // 内容为空
                ;
            } else {
                insertContent = indents + htmlAnchorLine + "\n\n";
            }

            this.docNewFullContent = this.insertContentBeforePos(this.docNewFullContent, insertPos, insertContent);
            this.docNewFullContent = this.delLinesContainedStr(this.docNewFullContent, ial);
        }
    }

    private async processVideoBlock(block: Block): Promise<void> {
        let ial: string = this.standardizeKramdown(block.ial);
        let parsedIAL: any[] = this.parseIALs(ial);
        if (parsedIAL.length > 0) {
            let htmlAnchorLine: string = parsedIAL[0].htmlanchortag;
            let insertPos: number = await this.getBlockContentStartPosInDoc(block, this.docNewFullContent);
            if (insertPos < 0) {
                return;
            }
            let indents: string = this.getFirstLineWithStrIndentsAsInDoc(ial); 
            let insertContent: string = "";
            if (block.markdown === "") {
                // 内容为空
                ;
            } else {
                insertContent = indents + htmlAnchorLine + "\n\n";
            }

            this.docNewFullContent = this.insertContentBeforePos(this.docNewFullContent, insertPos, insertContent);
            this.docNewFullContent = this.delLinesContainedStr(this.docNewFullContent, ial);
        }
    }

    /**
     * 处理列表块 
     * 
     * @async
     * @param {Block} block - 当前块对象
     * @param {Block} doc - 块所在的文档对象
     * @returns {Promise<void>}
     */
    private async processListBlock(block: Block, doc: Block): Promise<void> {
        if (block === undefined || block === null) {
            return;
        }
        if (doc === undefined || doc === null) {
            return;
        }
        let parentBlock: Block = await this.getParentBlock(block);
        if (parentBlock === undefined || parentBlock === null) {
            return;
        }

        //
        // 对于列表块, 需将HTML锚点标记插入到此块内容的上面, 且要空出一行, 例如:
        //
        // 当前文档的内容为:
        // * {: id="20240514233742-luuiga8" updated="20240516185457"}AA
        //   {: id="20240514233742-3zantb7" updated="20240514233742"}
        //
        //   * {: id="20240516185451-qdrq2bt" updated="20240516185457"}AA-1
        //     {: id="20240516185451-frotmdu" updated="20240516185457"}
        //   {: id="20240516185453-zr08rcl" updated="20240516185457"}
        // {: id="20240514214356-k3f05cy" updated="20240516185457"}
        //
        // {: id="20240514214356-lfmn7mh" updated="20240516185457"}
        //
        // 若当前块的内容为:
        // * {: id="20240514233742-luuiga8" updated="20240516185457"}AA
        //   {: id="20240514233742-3zantb7" updated="20240514233742"}
        //
        //   * {: id="20240516185451-qdrq2bt" updated="20240516185457"}AA-1
        //     {: id="20240516185451-frotmdu" updated="20240516185457"}
        //   {: id="20240516185453-zr08rcl" updated="20240516185457"}
        // {: id="20240514214356-k3f05cy" updated="20240516185457"}
        //
        // 则插入HTML锚点标记后的内容为:
        // <span id="20240514214356-k3f05cy-20240516185457"></span>
        //
        // * {: id="20240514233742-luuiga8" updated="20240516185457"}AA
        //   {: id="20240514233742-3zantb7" updated="20240514233742"}
        //
        //   * {: id="20240516185451-qdrq2bt" updated="20240516185457"}AA-1
        //     {: id="20240516185451-frotmdu" updated="20240516185457"}
        //   {: id="20240516185453-zr08rcl" updated="20240516185457"}
        //
        // {: id="20240514214356-lfmn7mh" updated="20240516185457"}
        // 
        let ial: string = this.standardizeKramdown(block.ial); 
        let dataAttr: string = "";

        if (parentBlock.type !== "l") {// list块的父块有可能是标题块
            dataAttr = "list"; 
        } else {
            // 以"根"list的视角, 其下属的子list也是content而不是list
            dataAttr = "list-content"; 
        }

        let parsedIAL: any[] = this.parseIALs(ial, dataAttr);
        if (parsedIAL.length > 0) {
            let htmlAnchorLine: string = parsedIAL[0].htmlanchortag;
            let insertPos: number = await this.getBlockContentStartPosInDoc(block, this.docNewFullContent);
            if (insertPos < 0) {
                return;
            }
            let indents: string = this.getFirstLineWithStrIndentsAsInDoc(ial); 
            let insertContent: string = "";
            if (block.markdown === "") {
                // 内容为空会在段落块逻辑里处理
            } else {
                let isNeedBlankLine: boolean = false;
                // 此列表块是某列表块的子块, 将HTML锚点标记插入到此块内容的上面, 不要空出一行;
                if (parentBlock.type === "l" || parentBlock.type === "i") {
                    isNeedBlankLine = false;
                } else {
                    // 此列表块不是列表块的子块, 需要空出一行, 比如它是标题块下面的列表;
                    // 紧邻标题块下的块会被划归为此标题块的子块;
                    isNeedBlankLine = true;
                }
                if (isNeedBlankLine) {
                    insertContent = indents + htmlAnchorLine + "\n\n";
                } else {
                    insertContent = indents + htmlAnchorLine + "\n";
                }
            }

            //
            // 例如: 
            //
            // "<span id="20240526173712-571dgud-20240526222146"></span>
            //
            // * {: id="20240526174107-01eeqkb" updated="20240526222146"}<span id="20240526174107-0bmsmbb-20240526174107"></span>aaaa
            //
            //   * {: id="20240526222144-339w7di" updated="20240526222146"}bbbb
            //     {: id="20240526222144-bgluwv4" updated="20240526222146"}
            //   {: id="20240526222145-ocxt1qy" updated="20240526222146"}
            //
            // {: id="20240526002034-hughthl" updated="20240526222146"}"
            //
            // 列表块
            //   * {: id="20240526222144-339w7di" updated="20240526222146"}bbbb
            //     {: id="20240526222144-bgluwv4" updated="20240526222146"}
            //   {: id="20240526222145-ocxt1qy" updated="20240526222146"}
            // 对应的HTML锚点标记为<span id="20240526222145-ocxt1qy-20240526222146"></span>, 
            // 在其起始处加入indents字符保持与bbbb所在行同缩进, 插入的的位置, 应该是此列表块在
            // 整个doc中的pos再减去indents长度, 这么做是为了保留插入位置后方的行的缩进;
            //
            insertPos = insertPos - indents.length; 
            this.docNewFullContent = this.insertContentBeforePos(this.docNewFullContent, insertPos, insertContent);
            this.docNewFullContent = this.delLinesContainedStr(this.docNewFullContent, ial);
            this.docNewFullContent = this.delBlankLinesUponLineContainedStr(this.docNewFullContent, htmlAnchorLine);
            this.docNewFullContent = this.delBlankLinesBetweenTwoLinesContainedAttr(this.docNewFullContent, "list-content");

            if (this.isOrderListSeriesBlock(block)) {// 有序列表
                this.docNewFullContent = this.havleIndentsOfLineContainedStr(this.docNewFullContent, htmlAnchorLine);
            }
        }
    }

    private isEvenNum(num: number): boolean {
        return num % 2 === 0;
    }

    private async processListItemBlock(block: Block): Promise<void> {
        let ial: string = this.standardizeKramdown(block.ial);
        let parsedIAL: any[] = this.parseIALs(ial);
        if (parsedIAL.length > 0) {
            let htmlAnchorLine: string = parsedIAL[0].htmlanchortag;
            let insertPos: number = await this.getBlockContentStartPosInDoc(block, this.docNewFullContent);
            if (insertPos < 0) {
                return;
            }
        }
    }

    private async getParentBlockType(block: Block): Promise<string> {
        if (block === undefined || block === null) {
            return "";
        }
        let parentBlock: Block = await getBlockByID(block.parent_id);
        if (parentBlock === undefined || parentBlock === null) {
            return "";
        }
        return parentBlock.type;
    }

    private async getParentBlock(block: Block): Promise<Block> {
        if (block === undefined || block === null) {
            return null;
        }
        let parentBlock: Block = await getBlockByID(block.parent_id);
        if (parentBlock === undefined || parentBlock === null) {
            return null;
        }
        return parentBlock;
    }

    /**
     * 找到首个包含str的行, 设置其缩进
     * 
     * @param {string} content - 内容
     * @param {string} str - 目标字符串
     * @param {string} indents - 缩进字符串(空格符)
     * @returns {string} 处理后的内容
     */
    private setLineContainedStrIndents(content: string, str: string, indents: string): string {
        this.plugin.checkInterrupt();
        if (content === undefined || content === null 
            || str === undefined || str === null 
            || indents === undefined || indents === null 
            || indents === "") {
            return content; 
        }
        let newContent: string = "";
        let lines: string[] = content.split("\n");
        let targetLineIdx: number = -1;
        for (let i = 0; i < lines.length; i++) {
            this.plugin.checkInterrupt();
            let curLine: string = lines[i];
            if (curLine.indexOf(str) >= 0) {
                targetLineIdx = i;
                break;
            }
        }
        if (targetLineIdx < 0) {
            return content;
        }
        let targetLine: string = lines[targetLineIdx];
        let newTargetLine: string = indents;
        let inProcess: boolean = false;
        for (let i = 0; i < targetLine.length; i++) {
            this.plugin.checkInterrupt();
            let curChar: string = targetLine[i];
            if (curChar !== " ") {
                inProcess = true;
            }
            if (inProcess) {
                newTargetLine += curChar;
            }
        }
        for (let i = 0; i < lines.length; i++) {
            this.plugin.checkInterrupt();
            let curLine: string = lines[i];
            if (i === targetLineIdx) {
                curLine = newTargetLine;
            }
            if (newContent === "") {
                newContent = curLine;
            } else {
                newContent = newContent + "\n" + curLine;
            }
        }
        return newContent;
    }

    /**
     * 找到首个包含str的行, 返回其缩进
     * 
     * @param {string} content - 内容
     * @param {string} str - 目标字符串
     * @returns {string} 处理后的内容
     */
    private getLineContainedStrIndents(content: string, str: string): string {
        this.plugin.checkInterrupt();
        if (content === undefined || content === null 
            || str === undefined || str === null) {
            return content; 
        }
        let indents: string = undefined;
        let lines: string[] = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
            this.plugin.checkInterrupt();
            let curLine: string = lines[i];
            if (curLine.indexOf(str) >= 0) {
                for (let j = 0; j < curLine.length; j++) {
                    let curChar: string = curLine[j];
                    if (curChar === " ") {
                        if (indents === undefined) {
                            indents = curChar;
                        } else {
                            indents += curChar;
                        }
                    } else {
                        break;
                    }
                }
                break;
            }
        }
        return indents;
    }

    /**
     * 删除所有包含指定字符串的行
     * 
     * @param {string} content - 内容
     * @param {string} str - 目标字符串
     * @returns {string} 处理后的内容
     */
    private delLinesContainedStr(content: string, str: string): string {
        this.plugin.checkInterrupt();
        if (content === undefined || content === null 
            || str === undefined || str === null) {
            return content; 
        }
        let newContent: string = "";
        let lines: string[] = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
            this.plugin.checkInterrupt();
            let curLine: string = lines[i];
            if (curLine.indexOf(str) < 0) {
                if (newContent === "") {
                    newContent = curLine;
                } else {
                    newContent = newContent + "\n" + curLine;
                }
            }
        }
        return newContent;
    }

    /**
     * 找出包含指定data-attr属性的行, 尝试在其下方加入一行空行, 若已存在空行则不做任何操作;
     * 
     * @param {string} content - 内容
     * @param {string} attr - 属性值 
     * @returns {string} 处理后的内容
     */
    private tryAddBlankLineAfterLinesContainedAttr(content: string, attr: string): string {
        this.plugin.checkInterrupt();
        if (content === undefined || content === null 
            || attr === undefined || attr === null) {
            return content; 
        }
        let newContent: string = content;
        let lines: string[] = content.split("\n");
        let targetLine: string = undefined;
        let targetNextLine: string = undefined;
        for (let i = 0; i < lines.length-1; i++) {
            this.plugin.checkInterrupt();
            let curLine: string = lines[i];
            let nextLine: string = lines[i+1];
            const regex = new RegExp(`<span id=.* data-attr=\"${attr}\"><\/span>`, "g");
            let match: RegExpMatchArray = curLine.match(regex);
            if (match === null) {
                continue;
            }
            targetLine = curLine;
            targetNextLine = nextLine;
            if (targetLine === undefined 
                || targetLine === null 
                || targetNextLine === undefined
                || targetNextLine === null) {
                continue;
            }
            if (targetNextLine === "") {// 下一行已是空行
                continue;
            }
            newContent = content.replace(targetLine, targetLine+"\n");
        }
        return newContent;
    } 

    /**
     * 行缩进减半
     * 
     * @param {string} content - 内容
     * @param {string} str - 目标字符串
     * @returns {string} 处理后的内容
     */
    private havleIndentsOfLineContainedStr(content: string, str: string): string {
        this.plugin.checkInterrupt();
        if (content === undefined || content === null 
            || str === undefined || str === null) {
            return content; 
        }
        if (this.indentsAdjustLinesRecordDict === undefined 
            || this.indentsAdjustLinesRecordDict === null) {
            return content; 
        }
        let newContent: string = content;
        if (!this.indentsAdjustLinesRecordDict.has(str)) {
            let indents: string = this.getLineContainedStrIndents(content, str);
            if (indents !== undefined) {
                let indentsCnt: number = indents.length;
                if (indentsCnt > 0) {
                    if (this.isEvenNum(indentsCnt)) {
                        let newIndents: string = indents.substring(0, indents.length/2); 
                        newContent = this.setLineContainedStrIndents(content, str, newIndents);
                        this.indentsAdjustLinesRecordDict.set(str, "");
                    }
                }
            }
        }
        return newContent;
    }

    /**
     * 将content中的某个字符串中的空格字符全部替换为HTML转义空格字符
     * 
     * @param {string} content - 内容
     * @param {string} renderedStr - 在思源笔记中看到的字符串内容
     * @param {string} markdownStr - 此字符串内容对应的Markdown内容
     * @returns {string} 处理后的内容
     * @example
     * 思源笔记中实际展示的内容为: "        AAAA        AAAA"
     * 其对应的Markdown标记(在文档的Kramdown中的实际内容)为: "AAAA        AAAA"
     * 替换后的内容为: "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;AAAA&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;AAAA"
     * 
     * 思源笔记中实际展示的内容(引用)为: "    BBBB    BBBB    "
     * 其对应的Markdown标记(在文档的Kramdown中的实际内容)为: "((20240611113503-61rjofw "BBBB    BBBB"))"
     * 替换后的内容为: "((20240611113503-61rjofw "&nbsp;&nbsp;&nbsp;&nbsp;BBBB&nbsp;&nbsp;&nbsp;&nbsp;BBBB&nbsp;&nbsp;&nbsp;&nbsp;"))" 
     */
    private replaceBlankCharToHtmlEscapeChar(content: string, renderedStr: string, markdownStr: string): string {
        this.plugin.checkInterrupt();
        if (content === undefined 
            || content === null 
            || content.length === 0
            || renderedStr === undefined 
            || renderedStr === null 
            || renderedStr.length === 0
            || markdownStr === undefined
            || markdownStr === null
            || markdownStr.length === 0) {
            return content; 
        }
        let frontBlankChars: string = ""; 
        let tailBlankChars: string = ""; 
        // "    BBBB    BBBB    " ==> "BBBB    BBBB"
        let excludeFrontTailBlankStr: string = renderedStr.trim(); 
        for (let i = 0; i < renderedStr.length; i++) {
            let curChar: string = renderedStr[i]; 
            if (curChar === " ") {
                frontBlankChars += curChar;
            } else {
                break;
            }
        }
        for (let i = renderedStr.length-1; i >= 0; i--) {
            let curChar: string = renderedStr[i]; 
            if (curChar === " ") {
                tailBlankChars += curChar;
            } else {
                break;
            }
        }
        
        let newContent: string = "";
        let newStr: string = "";
        for (let i = 0; i < renderedStr.length; i++) {
            let curChar: string = renderedStr[i];
            if (curChar === " ") {
                newStr += "&nbsp;";
            } else {
                newStr += curChar;
            }
        }
        let newMarkdownStr: string = markdownStr.replace(excludeFrontTailBlankStr, newStr);
        newContent = content.replace(markdownStr, newMarkdownStr);
        return newContent;
    }

    /**
     * 找出包含指定data-attr属性的行, 将两两之间的空行全部删除
     * 
     * @param {string} content - 内容
     * @param {string} attr - 属性值 
     * @returns {string} 处理后的内容
     * @example
     * AAXXAA 
     * 
     * ABCD
     * 
     * 
     * BXXBBB
     * 
     * CCCCXX
     * 
     * DDDDDD
     * 
     * str为"XX", 则处理结果为: 
     * AAXXAA 
     * ABCD
     * BXXBBB
     * CCCCXX
     * 
     * DDDDDD
     */
    private delBlankLinesBetweenTwoLinesContainedAttr(content: string, attr: string): string {
        this.plugin.checkInterrupt();
        if (content === undefined || content === null 
            || attr === undefined || attr === null) {
            return content; 
        }
        let newContent: string = "";
        let lines: string[] = content.split("\n");
        let targetLineIdxs = [];
        let excludeLineIdxs = [];
        let targetLineIdxs2 = [];
        for (let i: number = 0; i < lines.length; i++) {
            this.plugin.checkInterrupt();
            let curLine: string = lines[i];
            const regex = new RegExp(`<span id=.* data-attr=\"${attr}\"><\/span>`, "g");
            let match: RegExpMatchArray = curLine.match(regex);
            if (match !== null) {
                targetLineIdxs.push(i);
            }

            if (attr === "list-content") {
                // 两个list-content之间出现list的, 不予处理;
                const regex = new RegExp(`<span id=.* data-attr=\"list\"><\/span>`, "g");
                match = curLine.match(regex);
                if (match !== null) {
                    excludeLineIdxs.push(i);
                } else {
                    const regex = new RegExp(`<span id=.* data-attr=\"list-content-asset\"><\/span>`, "g");
                    match = curLine.match(regex);
                    if (match !== null) {
                        // 两个list-content之间出现list-content-asset的, 不予处理;
                        excludeLineIdxs.push(i);
                    }
                }
            }
        }
        let is: boolean = false;
        for (let i: number = 0; i < targetLineIdxs.length; i+=2) {
            this.plugin.checkInterrupt();
            is = true;
            let startLineIdx: number = targetLineIdxs[i];
            if (i+1 >= targetLineIdxs.length) {
                break;
            }
            let endLineIdx: number = targetLineIdxs[i+1];
            for (let k: number = 0; k < excludeLineIdxs.length; k++) {
                this.plugin.checkInterrupt();
                let excludeLineIdx: number = excludeLineIdxs[k];
                if (excludeLineIdx < endLineIdx && startLineIdx < excludeLineIdx) {
                    is = false;
                    break;
                }
            }
            if (is) {
                targetLineIdxs2.push(startLineIdx);
                targetLineIdxs2.push(endLineIdx);
            }
        }
        if (targetLineIdxs2.length < 2) {// 至少有两行才能处理
            return content;
        }
        is = false;
        let startLineIdx: number = -1;
        let endLineIdx: number = -1;
        for (let i: number = 0; i < lines.length; i++) {
            this.plugin.checkInterrupt();
            let curLine: string = lines[i];

            if (!is) {
                for (let j: number = 0; j < targetLineIdxs2.length-1; j++) {
                    this.plugin.checkInterrupt();
                    startLineIdx = targetLineIdxs2[j];
                    endLineIdx = targetLineIdxs2[j+1];
                    if (i === startLineIdx) {
                        is = true;
                        break;
                    }
                }
            }

            if (is) {
                if (i === endLineIdx) {
                    is = false;
                }
                if (curLine === "")  {
                    continue;
                }
            }
            if (newContent === "") {
                newContent = curLine;
            } else {
                newContent = newContent + "\n" + curLine;
            }
        }

        return newContent;
    }

    /**
     * 找出首个包含str的行, 删除紧邻其上方的连续空行
     * 
     * @param {string} content - 内容
     * @param {string} str - 目标字符串  
     * @returns {string} 处理后的内容
     */
    private delBlankLinesUponLineContainedStr(content: string, str: string): string {
        this.plugin.checkInterrupt();
        if (content === undefined || content === null 
            || str === undefined || str === null) {
            return content; 
        }

        let newContent: string = "";
        let lines: string[] = content.split("\n");
        let targetLineIdx: number = -1;
        for (let i = 0; i < lines.length; i++) {
            this.plugin.checkInterrupt();
            let curLine: string = lines[i];
            if (curLine.indexOf(str) >= 0) {
                targetLineIdx = i-1;
                break;
            } 
        }
        if (targetLineIdx < 0) {
            return content;
        }
        let inProcess: boolean = false;
        for (let i = lines.length-1; i >= 0; i--) {
            this.plugin.checkInterrupt();
            let curLine: string = lines[i];
            if (targetLineIdx === i) {
                inProcess = true;
            }
            if (inProcess) {
                if (curLine === "") {
                    continue;
                } else {
                    inProcess = false;
                }
            }
            if (newContent === "") {
                newContent = curLine;
            } else {
                newContent = curLine + "\n" + newContent;
            }
        }
        return newContent;
    }

    /**
     * 解析Kramdown内容中包含的所有IAL, Kramdown可以是单行或多行文本;
     * 
     * @param {string} kdContent - Kramdown内容
     * @param {string} htmlAnchorDes - 在解析结果中的HTML锚点标记中加入的自定义描述
     * @returns {any[]} 解析后的结果数组 
     */
    private parseIALs(kdContent: string, htmlAnchorDes: string = ""): any[] {
        this.plugin.checkInterrupt();
        let results: any[] = [];
        if (kdContent === undefined || kdContent === null) {
            return results;
        }
        // 
        // 需要关注的Kramdown标签格式通常是这样的: 
        // {: id="20240418133832-td0tmlh" updated="20240418133844"}
        // {: updated="20240411234143" id="20240411231131-acu4bra"}
        // {: id="20240412211810-c5h0la7" title="xx" type="doc" updated="20240413201129"}
        // {: id="20240418133833-htrydmb" updated=""}
        //
        // id字段一定存在, 其他字段不一定存在, 各字段的先后顺序不确定;
        // 在处理时, 只关注id和updated字段;
        //

        kdContent = this.standardizeKramdown(kdContent);

        let kdLines: string[] = kdContent.split("\n");
        for (let curLine of kdLines) {
            this.plugin.checkInterrupt();
            let match: RegExpMatchArray = curLine.match(/{:\s*(.*?)}/g); 
            if (match === undefined || match === null) {
                continue;
            }
            for (let curMatch of match) {
                this.plugin.checkInterrupt();
                let result = {};
                let id: string = "";
                let updated: string = "";
                let match2: RegExpExecArray = (/{:.*id="([^"]+)".*}/g).exec(curMatch);
                if (match2 === undefined || match2 === null) {
                    continue;
                }
                let match3: RegExpExecArray = (/{:.*updated="([^"]+)".*}/g).exec(curMatch);
                if (!(match3 === undefined || match3 === null)) {
                    updated = match3[1];
                } else {
                    updated = ""; // updated有可能不存在
                }
                id = match2[1];

                let anchorId: string = this.genAnchorId(id, updated);
                let htmlAnchor: string = "<span id=" + "\"" + anchorId + "\"" 
                    + " " + "data-attr=" + "\"" + htmlAnchorDes + "\"" + "></span>";
                let lineStartSpace: string = ""; 
                for (let c of curLine) {
                    this.plugin.checkInterrupt();
                    if (c !== ' ') {
                        break;
                    } else {
                        lineStartSpace += c;
                    }
                }

                result["ial"] = curMatch; // 本来的kd标签, 仅标签, 不包括标签所在行的其他字符
                result["id"] = id;
                result["updated"] = updated;
                result["htmlanchortag"] = htmlAnchor; // 生成的html锚点标签
                result["linestartspace"] = lineStartSpace; // 此kd标签所在行, 行首处的空格字符
                results.push(result);
            }
        }
        return results;
    }

    private genAnchorId(blockId: string, blockUpdated: string): string {
        this.plugin.checkInterrupt();
        let id: string = blockId;
        if (blockUpdated !== "") {
            id = id + "-" + blockUpdated;
        }
        return id;
    }

    /**
     * 在目标位置之前插入内容
     * 
     * @param {string} content - 内容
     * @param {number} pos - 目标位置
     * @param {string} insertContent - 待插入的内容
     * @returns {any[]} 解析后的结果数组 
     */
    private insertContentBeforePos(content: string, pos: number, insertContent: string): string {
        this.plugin.checkInterrupt();
        if (content === undefined 
            || content === null 
            || content === "") {
            return "";
        }
        if (pos === undefined 
            || pos === null 
            || pos < 0) {
            return content;
        }
        if (insertContent === undefined 
            || insertContent === null 
            || insertContent === "") {
            return content;
        }

        let newContent = content.slice(0, pos) + insertContent + content.slice(pos);
        return newContent;
    }

    private isListSeriesBlock(block: Block): boolean {
        if (block === undefined || block === null) {
            return false;
        }
        let type: string = block.type;
        if (type === "l" || type === "i") {
            return true;
        }
        return false;
    }

    private isOrderListSeriesBlock(block: Block): boolean {
        if (!this.isListSeriesBlock(block)) {
            return false;
        }
        let subType: string = block.subtype;
        if (subType === "o") {
            return true;
        }
        return false;
    }

    /**
     * 取得指定块所属的文档块对象 
     * 
     * @async
     * @param {string} block - 指定块对象
     * @returns {Block} 所属的文档块对象 
     */
    private async getDocTheBlockBelongs(block: Block): Promise<Block> {
        if (block === undefined || block === null) {
            return null;
        }
        let doc: Block = await getBlockByID(block.root_id);
        return doc;
    }

    /**
     * 将此块内容中对外发起的思源超链接转换为Markdown超链接 
     * 
     * @async
     * @param {string} kdContent - Kramdown内容
     * @param {Block} block - 块对象
     * @returns {Promise<string>} 处理后的Kramdown内容
     */
    public async processSiYuanLinksTo(kdContent: string, block: Block): Promise<string> {
        this.plugin.checkInterrupt();
        let newContent = kdContent;
        if (kdContent.length === 0) {
            return newContent;
        }
        let links = await this.parseSiYuanLinksOfBlock(block);
        for (let curLink of links) {
            let mdLink: string = this.convSiYuanLinkToMarkdown(curLink);
            newContent = newContent.replace(curLink["origin"], mdLink);
            this.plugin.updateProgress("思源链接转Markdown链接: " + kdContent + " to " + newContent);
        }
        return newContent;
    }

    /**
     * 找出指定块中通过思源链接发起的连接，例如：[1 第一章](siyuan://blocks/20240323160250-rpjzphm)
     * 
     * @async
     * @param {Block} block - 块对象
     * @returns {Promise<any>} 连接信息 
     */
    public async parseSiYuanLinksOfBlock(block: Block): Promise<any> {
        this.plugin.checkInterrupt();
        //
        // 1. 思源链接，是指带有 siyuan:// 协议头的链接；
        //
        // 2. 基于每个块的kramdown内容查找；
        //
        // 3. 一个块内可能有多个链接代码，例如：
        //    [block1](siyuan://blocks/20240323153215-r540olj) [block2](siyuan://blocks/20240323160746-m4fc7ay)
        //    {: updated="20240413161300" id="20240413161225-kxsh1uq"}
        //
        // 4. 代码块（块类型为"c"）中出现的[]()形式的文本应被视为正文；
        //
        // 5. 正文（段落块，类型为"p"）中若要显式呈现[]()形式的文本，只能通过转义字符实现，例如：[](\)，若不使用转义字符，思源笔记会将其展示为渲染后的效果；
        //    kramdown内容中带转义的链接字符串，不会被识别为链接；
        //
        // 6. 解析后
        //
        //    [block1](siyuan://blocks/20240323153215-r540olj)
        //
        //    origin: [block1](siyuan://blocks/20240323153215-r540olj)
        //    tblockid: 20240323153215-r540olj
        //    text: block1 
        //    link: siyuan://blocks/20240323153215-r540olj
        //

        let links: any[] = [];
        if (block === null || block === undefined) {
            return links;
        }

        let kd: string = (await getBlockKramdown(block.id)).kramdown;
        let match: RegExpMatchArray = kd.match(/\[[^\[\]]*\]\(\s*siyuan:\/\/[^\(\)]*\)/g);
        if (match === null) {
            return links;
        }

        // 一个块里可能有多个链接代码，下面一一处理
        for (let i in match) {
            this.plugin.checkInterrupt();
            let link = {};

            let match2: RegExpExecArray = (/\[(.*)]\((.*)\)/g).exec(match[i]);
            if (match2 === null || match2.length < 3) {
                continue;
            }

            link["origin"] = match2[0].trim();
            link["text"] = match2[1].trim();
            link["link"] = match2[2].trim();

            let match3: RegExpExecArray = (/(siyuan:\/\/.*\/)(.*)/g).exec(match2[2]);
            if (match3 === null || match3.length < 3) {
                link["tblockid"] = "";
            } else {
                link["tblockid"] = match3[2].trim();
            }

            let targetBlock: Block = await getBlockByID(link["tblockid"]);
            // 此链接代码所指向的块不存在，说明链接无效，视为正文
            if (targetBlock === undefined || targetBlock === null) {
                console.log("block " + block.id + ", linked to block " + link["link"] + " not exist");
                continue;
            }

            link["tblockhpath"] = targetBlock.hpath;
            link["tblocktype"] = targetBlock.type;
            link["tblockupdated"] = targetBlock.updated;

            let doc: Block = await this.getDocTheBlockBelongs(block);
            link["dblockhpath"] = doc.hpath;
            link["dcontent"] = doc.content; // 所属doc的名字

            this.plugin.updateProgress("对外链接: " + doc.id + " -> " + targetBlock.id);
            links.push(link);
        }
        return links;
    }

    private convSiYuanLinkToMarkdown(link: any): string {
        this.plugin.checkInterrupt();
        let mdLink: string = "";
        if (link === null || link === undefined) {
            return mdLink;
        }

        let docBlockHpath: string = link["dblockhpath"];
        let targetBlockHpath: string = link["tblockhpath"];
        if (targetBlockHpath === undefined || docBlockHpath === undefined) {
            return mdLink;
        }

        let dBlockHpathSplit: string[] = docBlockHpath.split("/"); 
        let tBlockHpathSplit: string[] = targetBlockHpath.split("/");
        let relativeTBlockHpath: string = targetBlockHpath;
        for (let i = 0; i < dBlockHpathSplit.length-1; i++) {
            this.plugin.checkInterrupt();
            if (dBlockHpathSplit[i] === tBlockHpathSplit[i]) {
                relativeTBlockHpath = relativeTBlockHpath.replace(dBlockHpathSplit[i]+"/", "");
                continue;
            }
            if (dBlockHpathSplit[i] !== tBlockHpathSplit[i] 
                || tBlockHpathSplit[i] !== undefined) {
                relativeTBlockHpath = "../" + relativeTBlockHpath;
            }
        }

        // console.log(docBlockHpath + " of " + targetBlockHpath + " ===>> " + relativeTBlockHpath);

        if (link["tblocktype"] === "d") {
            mdLink = "[" + link["text"] + "](" + relativeTBlockHpath + ".md)";
        } else {
            let anchorId = this.genAnchorId(link["tblockid"], link["tblockupdated"]);
            mdLink = "[" + link["text"] + "](" + relativeTBlockHpath + ".md#" + anchorId + ")";
        }

        return mdLink;
    }

    /**
     * 将此块内容中对外发起的思源引用转换为Markdown超链接
     * 
     * @async
     * @param {string} kdContent - Kramdown内容
     * @param {Block} block - 块对象
     * @returns {Promise<string>} 处理后的Kramdown内容
     */
    public async processSiYuanRefsTo(kdContent: string, block: Block): Promise<string> {

        if (block.id === "20240613141513-a9c8ax9") {
            console.log("xx-999-xx");
        }

        this.plugin.checkInterrupt();
        let newContent: string = kdContent;
        if (kdContent.length === 0) {
            return newContent;
        }
        let refs: any[] = await this.parseSiYuanRefsOfBlock(block);
        for (let curRef of refs) {
            let mdRef: string = this.convSiYuanRefToMarkdown(curRef);
            newContent = newContent.replace(curRef["origin"], mdRef);
            this.plugin.updateProgress("思源引用转Markdown链接: " + kdContent + " to " + newContent);
        }
        return newContent;
    }

    /**
     * 找出指定块中通过引用发起的连接，例如：((20240323160250-rpjzphm '1 第一章'))
     * 
     * @async
     * @param {Block} block - 块对象
     * @returns {Promise<any>} 连接信息
     */
    private async parseSiYuanRefsOfBlock(block: Block): Promise<any> {
        this.plugin.checkInterrupt();
        //
        // 1. 引用，是指这种形式的内容：((aaaaaaaa bb))，前面是目标块id，后面是描述；
        //
        // 2. 基于块的kramdown内容查找；
        //
        // 3. 一个块内可能有多个引用代码，例如：
        //    ((20240323160250-rpjzphm '2.4 AAAA'))    ((20240408145517-2hg65fh '3.2 BBBB'))
        //    {: id="20240412204642-0hygb2h" updated="20240412204844"}
        //
        // 4. 代码块（块类型为"c"）中出现的(())形式的文本应被视为正文；
        //
        // 5. 正文（段落块，类型为"p"）中可以显式写出(())形式的内容，至于它是正文还是引用，会在最后做统一验证；
        //    简单的验证方法，就是查看此目标块是否存在。正文的内容可能很随意, 例如 ((`20240415181856-me1qbk9`​\'x\')), 
        //    这显然是错的格式;
        // 
        // 6. 解析后
        //
        //    ((20240323160250-rpjzphm '  1 第一章节  '))
        //
        //    origin: ((20240323160250-rpjzphm '  1 第一章节  '))
        //    tblockid: 20240323160250-rpjzphm
        //    text: 1 第一章节
        //

        let refs = [];
        if (block === null || block === undefined) {
            return refs;
        }

        let kd: string = (await getBlockKramdown(block.id)).kramdown;
        let match: RegExpMatchArray = kd.match(/\(\(([^)]+)\)\)/g);
        if (match === null) {
            return refs;
        }

        // 一个块里可能有多个引用代码，下面一一处理
        for (let i in match) {
            this.plugin.checkInterrupt();

            let match2: RegExpExecArray = (/\(\((.*)\)\)/g).exec(match[i]);
            if (match2 === null || match2.length < 2) {
                continue;
            }
            let match3: RegExpExecArray = (/([^\s]+)\s*(.+)/g).exec(match2[1]);
            if (match3 === null || match3.length < 3) {
                continue;
            }

            let ref = {};
            let s = match3[2].trim();
            s = s.substring(0, s.length-1);
            s = s.substring(1, s.length);
            ref["origin"] = match2[0].trim();
            // ref["origin"] = this.replaceBlankCharToHtmlEscapeChar(ref["origin"], curBlock.content, curBlock.markdown);
            ref["tblockid"] = match3[1].trim();
            ref["text"] = s;

            // 此引用代码所引用的块不存在，说明引用无效，视为正文
            let targetBlock = null;
            try {
                targetBlock = await getBlockByID(ref["tblockid"]);
                if (targetBlock === undefined || targetBlock === null) {
                    console.log("block " + block.id + ", refed to block " + ref["tblockid"] + " not exist");
                    continue;
                }
            } catch (e) {
                console.warn(e);
                console.warn(kd + " parsed as " + ref["tblockid"]);
                continue;
            }

            ref["tblockhpath"] = targetBlock.hpath;
            ref["tblocktype"] = targetBlock.type;
            ref["tblockupdated"] = targetBlock.updated;

            let doc: Block = await this.getDocTheBlockBelongs(block);
            ref["dblockhpath"] = doc.hpath;
            ref["dcontent"] = doc.content; // 所属doc的名字

            this.plugin.updateProgress("对外引用: " + block.id + " -> " + targetBlock.id);
            refs.push(ref);
        }
        return refs;
    }

    private convSiYuanRefToMarkdown(ref: any): string {
        this.plugin.checkInterrupt();
        let mdRef: string = "";
        if (ref === null || ref === undefined) {
            return mdRef;
        }

        let docBlockHpath: string = ref["dblockhpath"];
        let targetBlockHpath: string = ref["tblockhpath"];
        if (targetBlockHpath === undefined || docBlockHpath === undefined) {
            return mdRef;
        }

        let dBlockHpathSplit: string[] = docBlockHpath.split("/"); 
        let tBlockHpathSplit: string[] = targetBlockHpath.split("/");
        let relativeTBlockHpath: string = targetBlockHpath;
        for (let i = 0; i < dBlockHpathSplit.length-1; i++) {
            this.plugin.checkInterrupt();
            if (dBlockHpathSplit[i] === tBlockHpathSplit[i]) {
                relativeTBlockHpath = relativeTBlockHpath.replace(dBlockHpathSplit[i]+"/", "");
                continue;
            }
            if (dBlockHpathSplit[i] !== tBlockHpathSplit[i] 
                || tBlockHpathSplit[i] !== undefined) {
                relativeTBlockHpath = "../" + relativeTBlockHpath;
            }
        }

        let relativeHpath: string = relativeTBlockHpath;
        let splited: string[] = relativeTBlockHpath.split("/");
        if (splited.length > 0) {
            let docName: string = splited[splited.length-1];
            if (docName === this.plugin.curRootDoc.content) {
                relativeHpath = relativeTBlockHpath.replace(docName, "index");
            }
        }

        if (ref["tblocktype"] === "d") {
            mdRef = "[" + ref["text"] + "](" + relativeHpath + ".md)";
        } else {
            let anchorId = this.genAnchorId(ref["tblockid"], ref["tblockupdated"]);
            mdRef = "[" + ref["text"] + "](" + relativeHpath + ".md#" + anchorId + ")";
        } 

        return mdRef;
    }

    private plugin: NoteToWebsitePlugin;
    private docOriginFullContent: string;
    private docNewFullContent: string;
    // 记录曾经调整过缩进的行, 避免重复调整, key: str, value: line;
    private indentsAdjustLinesRecordDict: Map<string, string>;
};