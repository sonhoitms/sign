/** @odoo-module **/

const { App, mount, useRef } = owl;
import SignOcaPdf from "../sign_oca_pdf/sign_oca_pdf.esm.js";
import {makeEnv, startServices} from "@web/env";
import {templates} from "@web/core/assets";
import { _t } from "@web/core/l10n/translation";
import {useService} from "@web/core/utils/hooks";
import { Registry } from "@web/core/registry";
import { patch } from "@web/core/utils/patch";

export class DuplicatedKeyError extends Error { }

patch(Registry.prototype, {
    add(key, value, { force, sequence } = {}) {
        if (!force && key in this.content) {
            console.error(`Cannot add '${key}' in this registry: it already exists`) 
                // Log the error for inspection
                // Optionally, handle the error in a different way or simply proceed
            return this;
        }
        let previousSequence;
        if (force) {
            const elem = this.content[key];
            previousSequence = elem && elem[0];
        }
        sequence = sequence === undefined ? previousSequence || 50 : sequence;
        this.content[key] = [sequence, value];
        const payload = { operation: "add", key, value };
        this.trigger("UPDATE", payload);
        return this;
    }
});

export const registry = new Registry();


export class SignOcaPdfPortal extends SignOcaPdf {
    setup() {
        super.setup(...arguments);
        this.signOcaFooter = useRef("sign_oca_footer");
        this.rpc = useService("rpc");
    }
    async willStart() {
        this.info = await this.rpc("/sign_oca/info/" +
                this.props.signer_id +
                "/" +
                this.props.access_token,
        );
    }

    getPdfUrl() {
        return (
            "/sign_oca/content/" + this.props.signer_id + "/" + this.props.access_token
        );
    }
    checkToSign() {
        this.to_sign = this.to_sign_update;
        if (this.to_sign_update) {
            $(this.signOcaFooter.el).show();
        } else {
            $(this.signOcaFooter.el).hide();
        }
    }
    postIframeFields() {
        super.postIframeFields(...arguments);
        this.checkFilledAll();
    }
    _onClickSign() {
        this.rpc("/sign_oca/sign/" + this.props.signer_id +
                    "/" + this.props.access_token,
                {items: this.info.items},
            )
            .then((action) => {
                // As we are on frontend env, it is not possible to use do_action(), so we
                // redirect to the corresponding URL or reload the page if the action is not
                // an url.
                if (action.type === "ir.actions.act_url") {
                    window.location = action.url;
                } else {
                    window.location.reload();
                }
            });
    }
}
SignOcaPdfPortal.template = "sign_oca.SignOcaPdfPortal";
SignOcaPdfPortal.props = {
    access_token: {type: String},
    signer_id: {type: Number},
};
export async function initDocumentToSign(properties) {
    const env = await makeEnv();
    await startServices(env);
    var app = new App(SignOcaPdfPortal, {
        templates, 
        env:env, 
        test: true,
        props: properties});

    return app.mount(document.body);
}