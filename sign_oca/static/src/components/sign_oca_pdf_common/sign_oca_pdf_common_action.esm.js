/** @odoo-module **/

import {Component} from "@odoo/owl";
import {FormRenderer} from "@web/views/form/form_renderer";
import SignOcaPdfCommon from "./sign_oca_pdf_common.esm.js";
import {registry} from "@web/core/registry";

export class SignOcaPdfCommonAction extends SignOcaPdfCommon {
    static props = ["*"];

    setup() {
        var action = this.props.action;
        var res_model = action.params.res_model ||
            (action.context.params && action.context.params.active_model) ||
            'sign.oca.request';

        var res_id = action.params.res_id !== undefined ?
            action.params.res_id :
            action.context.active_id || undefined;

        this.props.res_model = res_model;
        this.props.res_id = res_id;

        super.setup();

    }
    async start() {
        await this._super(...arguments);
        this.component = new FormRenderer(this, SignOcaPdfCommon, {
            model: this.props.model,
            res_id: this.props.res_id,
        });
        this.$el.addClass("o_sign_oca_action");
        return this.component.mount(this.$(".o_content")[0]);
    }
    getState() {
        var result = this._super(...arguments);
        result = _.extend({}, result, {
            res_model: this.props.model,
            res_id: this.props.res_id,
        });
        return result;
    }
}
registry.category("actions").add("sign_oca_preview", SignOcaPdfCommonAction);
