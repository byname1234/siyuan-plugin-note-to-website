const fs = require("fs");
const path = require("path");

/**
 * 删除指定目录下的所有内容
 * 
 * @param {string} folderPath - 指定目录 
 * @param {string[]} excludeDirOrFileList - 忽略项 
 * @returns {void}
 */
export function deleteUnderFolderRecursive(folderPath: string, excludeDirOrFileList: string[] = []): void {
    this.plugin.checkInterrupt();
    if (fs.existsSync(folderPath)) {
        fs.readdirSync(folderPath).forEach((file: string) => {
            let curPath: string = path.join(folderPath, file);
            if (excludeDirOrFileList.includes(curPath)) {
                return; // 如果当前路径在排除列表中，则跳过
            }
            if (fs.lstatSync(curPath).isDirectory()) {
                this.deleteUnderFolderRecursive(curPath, excludeDirOrFileList);
            } else {
                if (!excludeDirOrFileList.includes(curPath)) {
                    fs.unlinkSync(curPath); // 删除文件，如果不在排除列表中
                }
            }
        });
    }
}

export function deleteDirectorySync(directoryPath): void {
    if (!fs.existsSync(directoryPath)) {
        return;
    }
    let files: string[] = fs.readdirSync(directoryPath);
    for (let file of files) {
        let filePath: string = path.join(directoryPath, file);
        try {
            if (fs.statSync(filePath).isDirectory()) {
                // 如果是目录，递归调用删除函数
                this.deleteDirectorySync(filePath);
            } else {
                try {
                    // 如果是文件，直接删除
                    fs.unlinkSync(filePath);
                } catch (error) {
                    console.warn(`无法删除文件 ${filePath}: ${error.message}`);
                }
            }
        } catch (error) {
            console.warn(`无法获取文件信息 ${filePath}: ${error.message}`);
        }
    }
    try {
        // 删除空目录
        fs.rmdirSync(directoryPath);
    } catch (error) {
        console.warn(`无法删除目录 ${directoryPath}: ${error.message}`);
    }
}