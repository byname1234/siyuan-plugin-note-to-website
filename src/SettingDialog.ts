import { Dialog } from "siyuan";
import NoteToWebsitePlugin, { STORAGE_NAME } from "./index";

export class SettingDialog extends Dialog {
     constructor(plugin: NoteToWebsitePlugin) {
        let options = {
            title: plugin.name,
            content: `
            <div class="b3-dialog__body">
              <div class="b3-dialog__content">

                <div class="fn__flex b3-label config__item">
                  <div class="fn__flex-1">网站名</div>
                  <span class="fn__space"></span>
                  <input class="b3-text-field fn__flex-center fn__size200" id="websitename"></input>
                </div>

                <div class="fn__flex b3-label config__item">
                  <div class="fn__flex-1">
                    网站Logo
                    <div class="b3-label__text">
                      assets目录下的图片文件
                    </div>
                  </div>
                  <span class="fn__space"></span>
                  <input class="b3-text-field fn__flex-center fn__size200" id="websitelogofilename"></input>
                </div>

                <div class="fn__flex b3-label config__item">
                  <div class="fn__flex-1">
                    网站favicon
                    <div class="b3-label__text">assets目录下的图片文件</div>
                  </div>
                  <span class="fn__space"></span>
                  <input class="b3-text-field fn__flex-center fn__size200" id="websiteiconfilename"></input>
                </div>

                <div class="fn__flex b3-label config__item">
                  <div class="fn__flex-1">
                    网站底部
                    <div class="b3-label__text">支持HTML标签</div>
                  </div>
                  <span class="fn__space"></span>
                  <input class="b3-text-field fn__flex-center fn__size200" id="websitefooter"></input>
                </div>

                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">
                      图片尺寸调整参数
                      <div class="b3-label__text">在笔记中调整过宽度的图片, 其在网站中的尺寸可能不准确, 可通过此参数做调整</div>
                  </div>
                  <span class="fn__space"></span>
                  <input class="b3-text-field fn__flex-center fn__size200" id="websiteimgadjustparam" type="number"></input>
                </div>

                <div class="fn__flex b3-label config__item">
                  <div class="fn__flex-1">
                  网站生成引擎
                  </div>
                  <span class="fn__space"></span>
                  <select class="b3-select fn__flex-center fn__size200" id="websiteengine">
                    <option value="mkdocs">MkDocs</option>
                    <option value="hexo" disabled>Hexo</option>
                    <option value="jekyll" disabled>Jekyll</option>
                  </select>
                </div>

                <div class="fn__flex b3-label config__item">
                  <div class="fn__flex-1">
                    自动打开网站目录
                    <div class="b3-label__text">生成网站后自动打开网站根目录</div>
                  </div>
                  <span class="fn__space"></span>
                  <input type="checkbox" class="b3-switch fn__flex-center" id="isalwaysopenwebsitedir"></input>
                </div>

                <div class="fn__flex b3-label config__item">
                  <div class="fn__flex-1">
                    总是重建Python虚拟环境
                    <div class="b3-label__text">每次生成网站之前都重新创建Python虚拟环境</div>
                  </div>
                  <span class="fn__space"></span>
                  <input type="checkbox" class="b3-switch fn__flex-center" id="isalwaysrecreatepythonvenv"></input>
                </div>
            
                <div class="fn__flex b3-label config__item">
                  <div class="fn__flex-1">
                    总是重装MkDocs引擎
                    <div class="b3-label__text">每次生成网站之前都重新安装MkDocs及其依赖</div>
                  </div>
                  <span class="fn__space"></span>
                  <input type="checkbox" class="b3-switch fn__flex-center" id="isalwaysreinstallmkdocs"></input>
                </div> 

                <div class="fn__flex b3-label config__item">
                  <div class="fn__flex-1"></div>
                  <span class="fn__space"></span>
                  <button class="b3-button b3-button--outline fn__flex-center fn__size200" id="usedefaultcnfbtn">
                    使用缺省配置
                  </button>
                </div>

                <div class="b3-dialog__action">
                  <button class="b3-button b3-button--cancel" id="cancelbtn">取消</button>
                  <div class="fn__space"></div>
                  <button class="b3-button b3-button--text" id="savebtn">保存</button>
                </div>

              </div>
            </div>
            `,
            width: plugin.isMobile ? "92vw" : "600px",
        };
        super(options);
        this.plugin = plugin;
    }

    public init(): void {
        this.websitenameInput = this.element.querySelector("#websitename") as HTMLInputElement;
        this.websiteLogoFileNameInput = this.element.querySelector("#websitelogofilename") as HTMLInputElement;
        this.websiteIconFileNameInput = this.element.querySelector("#websiteiconfilename") as HTMLInputElement;
        this.websiteFooterInput = this.element.querySelector("#websitefooter") as HTMLInputElement;
        this.websiteImgAdjustParamInput = this.element.querySelector("#websiteimgadjustparam") as HTMLInputElement; 
        this.websiteEngineSelect = this.element.querySelector("#websiteengine") as HTMLSelectElement;
        this.isAlwaysRecreatePythonVenvInput = this.element.querySelector("#isalwaysrecreatepythonvenv") as HTMLInputElement;
        this.isAlwaysOpenWebsiteDirInput = this.element.querySelector("#isalwaysopenwebsitedir") as HTMLInputElement;
        this.isAlwaysReinstallMkDocsInput = this.element.querySelector("#isalwaysreinstallmkdocs") as HTMLInputElement;
        this.useDefaultCnfBtn = this.element.querySelector("#usedefaultcnfbtn") as HTMLButtonElement;
        this.cancelBtn = this.element.querySelector("#cancelbtn") as HTMLButtonElement;
        this.saveBtn = this.element.querySelector("#savebtn") as HTMLButtonElement;
        this.useDefaultCnfBtn.addEventListener("click", () => this.onDefaultCnfBtnClicked());
        this.cancelBtn.addEventListener("click", () => this.onCancelBtnClicked());
        this.saveBtn.addEventListener("click", () => this.onSaveBtnClicked());
        this.plugin.loadData(STORAGE_NAME).then(() => {
            console.log(this.plugin.data[STORAGE_NAME]);
            this.websitenameInput.value = this.plugin.data[STORAGE_NAME].websitename;
            this.websiteLogoFileNameInput.value = this.plugin.data[STORAGE_NAME].websitelogofilename;
            this.websiteIconFileNameInput.value = this.plugin.data[STORAGE_NAME].websiteiconfilename;
            this.websiteFooterInput.value = this.plugin.data[STORAGE_NAME].websitefooter;
            this.websiteEngineSelect.value = this.plugin.data[STORAGE_NAME].websiteengine;
            this.isAlwaysRecreatePythonVenvInput.checked = this.plugin.data[STORAGE_NAME].isalwaysrecreatepythonvenv;
            this.isAlwaysOpenWebsiteDirInput.checked = this.plugin.data[STORAGE_NAME].isalwaysopenwebsitedir;
            this.isAlwaysReinstallMkDocsInput.checked = this.plugin.data[STORAGE_NAME].isalwaysreinstallmkdocs;
            this.websiteImgAdjustParamInput.value = this.plugin.data[STORAGE_NAME].websiteimgadjustparam;
        });
    }

    private onDefaultCnfBtnClicked(): void {
        this.websitenameInput.value = this.plugin.websiteNameDefault;
        this.websiteLogoFileNameInput.value = this.plugin.websiteLogoFileNameDefault;
        this.websiteIconFileNameInput.value = this.plugin.websiteIconFileNameDefault;
        this.isAlwaysRecreatePythonVenvInput.checked = this.plugin.isAlwaysRecreatePythonVenvDefault;
        this.isAlwaysReinstallMkDocsInput.checked = this.plugin.isAlwaysReinstallMkDocsDefault;
        this.isAlwaysOpenWebsiteDirInput.checked = this.plugin.isAlwaysOpenWebsiteDirDefault;
        this.websiteEngineSelect.value = this.plugin.websiteEngineDefault;
        this.websiteFooterInput.value = this.plugin.websiteFooterDefault;
        this.websiteImgAdjustParamInput.value = this.plugin.websiteImgAdjustParamDefault.toString();
    }

    private onCancelBtnClicked(): void {
        this.destroy();
    }

    private onSaveBtnClicked(): void {
        let data = {
            userEverSavedFlag: "1",
            websitename: this.websitenameInput.value,
            websitelogofilename: this.websiteLogoFileNameInput.value,
            websiteiconfilename: this.websiteIconFileNameInput.value,
            websitefooter: this.websiteFooterInput.value,
            websiteengine: this.websiteEngineSelect.value,
            isalwaysopenwebsitedir: this.isAlwaysOpenWebsiteDirInput.checked,
            isalwaysrecreatepythonvenv: this.isAlwaysRecreatePythonVenvInput.checked,
            isalwaysreinstallmkdocs: this.isAlwaysReinstallMkDocsInput.checked,
            websiteimgadjustparam: this.websiteImgAdjustParamInput.value
        };

        this.plugin.saveData(STORAGE_NAME, data).then(() => {
            this.destroy();
        });
    }

    private plugin: NoteToWebsitePlugin;
    private websitenameInput: HTMLInputElement;
    private websiteLogoFileNameInput: HTMLInputElement;
    private websiteIconFileNameInput: HTMLInputElement;
    private websiteFooterInput: HTMLInputElement;
    private websiteEngineSelect: HTMLSelectElement;
    private isAlwaysRecreatePythonVenvInput: HTMLInputElement;
    private isAlwaysOpenWebsiteDirInput: HTMLInputElement;
    private websiteImgAdjustParamInput: HTMLInputElement; 
    private isAlwaysReinstallMkDocsInput: HTMLInputElement;
    private useDefaultCnfBtn: HTMLButtonElement;
    private cancelBtn: HTMLButtonElement;
    private saveBtn: HTMLButtonElement;
};