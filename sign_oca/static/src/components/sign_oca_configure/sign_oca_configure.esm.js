/** @odoo-module QWeb **/

import {ControlPanel} from "@web/search/control_panel/control_panel";
import {SignOcaDialog} from "../../js/dialog.js";
import SignOcaPdfCommon from "../sign_oca_pdf_common/sign_oca_pdf_common.esm.js";
import {_t} from "@web/core/l10n/translation";
import {registry} from "@web/core/registry";
import {renderToString} from "@web/core/utils/render";
import {useService} from "@web/core/utils/hooks";
import { useState } from "@odoo/owl";

export class SignOcaConfigureControlPanel extends ControlPanel {}
SignOcaConfigureControlPanel.template = "sign_oca.SignOcaConfigureControlPanel";
export class SignOcaConfigure extends SignOcaPdfCommon {
    static props = ["*"];
    static template = "sign_oca.SignOcaConfigure";
    setup() {
        super.setup(...arguments);
        this.field_template = "sign_oca.sign_iframe_field_configure";
        this.contextMenu = undefined;
        this.isMobile = this.env.isMobile || this.env.isMobileDevice;
        this.dialog = useService('dialog');
        this.orm = useService('orm');
    }
    postIframeFields() {
        super.postIframeFields(...arguments);
        var entries_pages = this.iframe.el.contentDocument.getElementsByClassName("page");
        if (entries_pages) {
            for(const [index, page] of Object.entries(entries_pages)){
                page.addEventListener("mousedown", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                });
                page.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (this.contextMenu !== undefined) {
                        this.contextMenu.remove();
                        this.contextMenu = undefined;
                    }
                    var position = page.getBoundingClientRect();
                    this.contextMenu = $(
                        renderToString("sign_oca.sign_iframe_contextmenu", {
                            page,
                            e,
                            left: ((e.pageX - position.x) * 100) / position.width + "%",
                            top: ((e.pageY - position.y) * 100) / position.height + "%",
                            info: this.info,
                            page_id: parseInt(page.dataset.pageNumber, 10),
                        })
                    );
                    page.append(this.contextMenu[0]);
                });
            }
        };
        this.iframe.el.contentDocument.addEventListener(
            "click",
            (ev) => {
                if (this.contextMenu && !this.creatingItem) {
                    if (this.contextMenu[0].contains(ev.target)) {
                        this.creatingItem = true;
                        this.orm.call(this.props.res_model, "add_item", [
                            [this.props.res_id],{
                                field_id: parseInt(ev.target.dataset.field, 10),
                                page: parseInt(ev.target.dataset.page, 10),
                                position_x: parseFloat(ev.target.parentElement.style.left),
                                position_y: parseFloat(ev.target.parentElement.style.top),
                                width: 20,
                                height: 1.5,
                            }
                        ]).then((data) => {
                            this.info.items[data.id] = data;
                            this.postIframeField(data);
                            this.contextMenu.remove();
                            this.contextMenu = undefined;
                            this.creatingItem = false;
                        })
                    } else {
                        this.contextMenu.remove();
                        this.contextMenu = undefined;
                    }
                }
            },
            // We need to enforce it to happen no matter what
            true
        );
        this.iframeLoaded.resolve();
    }
    postIframeField(item) {
        var signatureItem = super.postIframeField(...arguments);
        var dragItem =
            signatureItem[0].getElementsByClassName("o_sign_oca_draggable")[0];
        var resizeItems = signatureItem[0].getElementsByClassName("o_sign_oca_resize");
        signatureItem[0].addEventListener(
            "click",
            (e) => {
                if (
                    e.target.classList.contains("o_sign_oca_resize") ||
                    e.target.classList.contains("o_sign_oca_draggable")
                ) {
                    return;
                }
                var target = e.currentTarget;
                // TODO: Open Dialog for configuration
                this.dialog.add(SignOcaDialog, {
                    item: item,
                    info: this.info,
                    model: this.props.res_model,
                    res_id: this.props.res_id,
                    SignOcaConfigure: this,
                    });
            },
            true
        );
        var startFunction = "mousedown";
        var endFunction = "mouseup";
        var moveFunction = "mousemove";
        if (this.isMobile) {
            startFunction = "touchstart";
            endFunction = "touchend";
            moveFunction = "touchmove";
        }
        dragItem.addEventListener(startFunction, (mousedownEvent) => {
            mousedownEvent.preventDefault();
            var parentPage = mousedownEvent.target.parentElement.parentElement;
            this.movingItem = mousedownEvent.target.parentElement;
            var mousemove = this._onDragItem.bind(this);
            parentPage.addEventListener(moveFunction, mousemove);
            parentPage.addEventListener(
                endFunction,
                (mouseupEvent) => {
                    mouseupEvent.currentTarget.removeEventListener(
                        moveFunction,
                        mousemove
                    );
                    var target = $(this.movingItem);
                    var position = target.parent()[0].getBoundingClientRect();
                    var newPosition = mouseupEvent;
                    if (mouseupEvent.changedTouches) {
                        newPosition = mouseupEvent.changedTouches[0];
                    }
                    var left =
                        (Math.max(
                            0,
                            Math.min(position.width, newPosition.pageX - position.x)
                        ) *
                            100) /
                        position.width;
                    var top =
                        (Math.max(
                            0,
                            Math.min(position.height, newPosition.pageY - position.y)
                        ) *
                            100) /
                        position.height;
                    target.css("left", left + "%");
                    target.css("top", top + "%");
                    item.position_x = left;
                    item.position_y = top;
                    this.orm.call(this.props.res_model, "set_item_data", [[this.props.res_id], item.id, { position_x: left, position_y: top }]);
                    this.movingItem = undefined;
                },
                {once: true}
            );
        });
        
        for(const [index, resizeItem] of Object.entries(resizeItems)){
            resizeItem.addEventListener(startFunction, (mousedownEvent) => {
                mousedownEvent.preventDefault();
                var parentPage = mousedownEvent.target.parentElement.parentElement;
                this.resizingItem = mousedownEvent.target.parentElement;
                var mousemove = this._onResizeItem.bind(this);
                parentPage.addEventListener(moveFunction, mousemove);
                parentPage.addEventListener(
                    endFunction,
                    (mouseupEvent) => {
                        mouseupEvent.stopPropagation();
                        mouseupEvent.preventDefault();
                        mouseupEvent.currentTarget.removeEventListener(
                            moveFunction,
                            mousemove
                        );
                        var target = $(this.resizingItem);
                        var newPosition = mouseupEvent;
                        if (mouseupEvent.changedTouches) {
                            newPosition = mouseupEvent.changedTouches[0];
                        }
                        var targetPosition = target
                            .find(".o_sign_oca_resize")[0]
                            .getBoundingClientRect();
                        var itemPosition = target[0].getBoundingClientRect();
                        var pagePosition = target.parent()[0].getBoundingClientRect();
                        var width =
                            (Math.max(
                                0,
                                newPosition.pageX +
                                    targetPosition.width -
                                    itemPosition.x
                            ) *
                                100) /
                            pagePosition.width;
                        var height =
                            (Math.max(
                                0,
                                newPosition.pageY +
                                    targetPosition.height -
                                    itemPosition.y
                            ) *
                                100) /
                            pagePosition.height;
                        target.css("width", width + "%");
                        target.css("height", height + "%");
                        item.width = width;
                        item.height = height;
                        this.orm.call(this.props.res_model, "set_item_data", [
                                [this.props.res_id],
                                item.id,
                                {
                                    width: width,
                                    height: height,
                                },
                            ],
                        );
                    },
                    {once: true}
                );
            });
        };
        return signatureItem;
    }
    _onResizeItem(e) {
        e.stopPropagation();
        e.preventDefault();
        var target = $(this.resizingItem);
        var targetPosition = target
            .find(".o_sign_oca_resize")[0]
            .getBoundingClientRect();
        var itemPosition = target[0].getBoundingClientRect();
        var newPosition = e;
        if (e.targetTouches) {
            newPosition = e.targetTouches[0];
        }
        var pagePosition = target.parent()[0].getBoundingClientRect();
        var width =
            (Math.max(0, newPosition.pageX + targetPosition.width - itemPosition.x) *
                100) /
            pagePosition.width;
        var height =
            (Math.max(0, newPosition.pageY + targetPosition.height - itemPosition.y) *
                100) /
            pagePosition.height;
        target.css("width", width + "%");
        target.css("height", height + "%");
    }
    _onDragItem(e) {
        e.stopPropagation();
        e.preventDefault();
        var target = $(this.movingItem);
        var position = target.parent()[0].getBoundingClientRect();
        var newPosition = e;
        if (e.targetTouches) {
            newPosition = e.targetTouches[0];
        }
        var left =
            (Math.max(0, Math.min(position.width, newPosition.pageX - position.x)) *
                100) /
            position.width;
        var top =
            (Math.max(0, Math.min(position.height, newPosition.pageY - position.y)) *
                100) /
            position.height;
        target.css("left", left + "%");
        target.css("top", top + "%");
    }
}

export class SignOcaConfigureAction extends SignOcaConfigure {
    static props = ["*"];

    setup() {
        var action = this.props.action;
        var res_model = action.params.res_model ||
            (action.context.params && action.context.params.active_model) ||
            'sign.oca.template';

        var res_id = action.params.res_id !== undefined ?
            action.params.res_id :
            action.context.active_id || undefined;

        this.props.res_model = res_model;
        this.props.res_id = res_id;

        super.setup();

    }
}

registry.category("actions").add("sign_oca_configure", SignOcaConfigureAction);