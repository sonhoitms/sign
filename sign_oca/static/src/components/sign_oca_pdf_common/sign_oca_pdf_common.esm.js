/** @odoo-module QWeb **/
import {Component, onMounted, onWillStart, onWillUnmount, useRef} from "@odoo/owl";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import {_t} from "@web/core/l10n/translation";
import {renderToString} from "@web/core/utils/render";
import { useService } from '@web/core/utils/hooks';

export default class SignOcaPdfCommon extends Component {
    static props = {
        model: String,
        res_id: Number,
    }
    setup() {
        super.setup();
        this.field_template = "sign_oca.sign_iframe_field";
        console.log(this.props);
        this.pdf_url = this.getPdfUrl();
        this.viewer_url = "/web/static/lib/pdfjs/web/viewer.html?file=" + this.pdf_url;
        this.iframe = useRef("sign_oca_iframe");
        var iframeResolve = "";
        var iframeReject = "";
        this.iframeLoaded = new Promise(function (resolve, reject) {
            iframeResolve = resolve;
            iframeReject = reject;
        });
        this.items = {};
        this.dialog = useService('dialog');
        onWillUnmount(() => {
            clearTimeout(this.reviewFieldsTimeout);
        });
        this.iframeLoaded.resolve = iframeResolve;
        this.iframeLoaded.reject = iframeReject;
        onWillStart(this.willStart);
        onMounted(() => {
            this.waitIframeLoaded();
        });
    }
    getPdfUrl() {
        return "/web/content/" + this.props.res_model + "/" + this.props.res_id + "/data";
    }
    async willStart() {
        this.info = await this.env.services.orm.call(
            this.props.res_model,
            "get_info",
            [[this.props.res_id]],
        );
    }
    waitIframeLoaded() {
        var error = this.iframe.el.contentDocument.getElementById("errorWrapper");
        if (error && window.getComputedStyle(error).display !== "none") {
            this.iframeLoaded.resolve();
            this.dialog.add(AlertDialog, {
                title: _t("Alert !"),
                body: _t("Need a valid PDF to add signature fields !"),
            });
            return
        }
        var nbPages =
            this.iframe.el.contentDocument.getElementsByClassName("page").length;
        var nbLayers =
            this.iframe.el.contentDocument.getElementsByClassName(
                "endOfContent"
            ).length;
        if (nbPages > 0 && nbLayers > 0) {
            this.postIframeFields();
            this.reviewFields();
        } else {
            var self = this;
            setTimeout(function () {
                self.waitIframeLoaded();
            }, 1000);
        }
    }
    reviewFields() {
        if (
            this.iframe.el.contentDocument.getElementsByClassName("o_sign_oca_ready")
                .length === 0
        ) {
            this.postIframeFields();
        }
        this.reviewFieldsTimeout = setTimeout(this.reviewFields.bind(this), 1000);
    }
    async postIframeFields() {
        this.iframe.el.contentDocument
            .getElementById("viewerContainer")
            .addEventListener(
                "drop",
                (e) => {
                    e.stopImmediatePropagation();
                    e.stopPropagation();
                },
                true
            );
        var iframeCss = document.createElement("link");
        iframeCss.setAttribute("rel", "stylesheet");
        iframeCss.setAttribute("href", "/sign_oca/get_assets.css");
        this.iframe.el.contentDocument
            .getElementsByTagName("head")[0]
            .append(iframeCss);
        var iframeJs = document.createElement("script");
        iframeJs.setAttribute("type", "text/javascript");
        iframeJs.setAttribute("src", "/sign_oca/get_assets.js");

        await this.iframe.el.contentDocument.getElementsByTagName("head")[0].append(iframeJs);
        
        for(const [id, item] of Object.entries(this.info.items)){
            await this.postIframeField(item);
        }
        $(this.iframe.el.contentDocument.getElementsByClassName("page")[0]).append(
            $("<div class='o_sign_oca_ready'/>")
        );

        $(this.iframe.el.contentDocument.getElementById("viewer")).addClass(
            "sign_oca_ready"
        );
        this.iframeLoaded.resolve();
    }
    postIframeField(item) {
        if (this.items[item.id]) {
            this.items[item.id].remove();
        }
        var page =
            this.iframe.el.contentDocument.getElementsByClassName("page")[
                item.page - 1
            ];
        var signatureItem = $(
            renderToString(this.field_template, {
                ...item,
            })
        );
        page.append(signatureItem[0]);
        this.items[item.id] = signatureItem[0];
        return signatureItem;
    }
}
SignOcaPdfCommon.template = "sign_oca.SignOcaPdfCommon";
